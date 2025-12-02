const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');

// --- REGISTRO DE NUEVO USUARIO ---
router.post('/', async (req, res) => {
  try {
    const { nombre, apellido, fecha_nacimiento, genero, email, password, telefono } = req.body;

    // Verificar si el usuario ya existe
    const userExists = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    // Hashear la contraseña
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insertar nuevo usuario
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, apellido, fecha_nacimiento, genero, email, password_hash, telefono) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, nombre, apellido, email',
      [nombre, apellido, fecha_nacimiento, genero, email, password_hash, telefono]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- LOGIN DE USUARIO ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario por email
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Credenciales inválidas.' });
    }

    const user = result.rows[0];

    // Comparar contraseñas
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Credenciales inválidas.' });
    }

    // Crear y firmar tokens JWT: access token (corto) y refresh token (largo)
    const payload = {
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido
      }
    };

    const jwtSecret = process.env.JWT_SECRET || 'YOUR_JWT_SECRET';
    const accessExpires = process.env.JWT_ACCESS_EXPIRES || '15m'; // Token de acceso: 15 min
    const refreshExpires = process.env.JWT_REFRESH_EXPIRES || '7d'; // Token de refresh: 7 días

    const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: accessExpires });
    const refreshToken = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: refreshExpires });

    res.json({ token: accessToken, refreshToken });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener estadísticas del usuario (contadores para badges)
router.get('/stats/counts', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Contar propiedades del usuario
    const propiedadesQuery = `
      SELECT COUNT(*) as count 
      FROM propiedad 
      WHERE id_propietario = $1 
        AND estado_publicacion != 'archivada'
    `;

    // Contar favoritos del usuario
    const favoritosQuery = `
      SELECT COUNT(*) as count 
      FROM favoritos 
      WHERE id_usuario = $1
    `;

    const [propiedadesResult, favoritosResult] = await Promise.all([
      pool.query(propiedadesQuery, [userId]),
      pool.query(favoritosQuery, [userId])
    ]);

    res.json({
      myPropertiesCount: parseInt(propiedadesResult.rows[0].count) || 0,
      favoritesCount: parseInt(favoritosResult.rows[0].count) || 0
    });
  } catch (err) {
    console.error('Error al obtener estadísticas del usuario:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- REFRESH TOKEN ---
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token requerido.' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'YOUR_JWT_SECRET';
    
    // Verificar el refresh token
    const decoded = jwt.verify(refreshToken, jwtSecret);
    const userId = decoded.userId;

    // Obtener datos actualizados del usuario
    const result = await pool.query('SELECT id, email, nombre, apellido FROM usuarios WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = result.rows[0];
    const payload = {
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido
      }
    };

    const accessExpires = process.env.JWT_ACCESS_EXPIRES || '15m';
    const newAccessToken = jwt.sign(payload, jwtSecret, { expiresIn: accessExpires });

    res.json({ token: newAccessToken });
  } catch (err) {
    console.error('Error al refrescar token:', err);
    res.status(401).json({ error: 'Refresh token inválido o expirado.' });
  }
});

module.exports = router;

// --- VERIFICAR TOKEN ---
router.get('/verify', authMiddleware, (req, res) => {
  res.status(200).json({ message: 'Token válido.', user: req.user });
});

// --- OTRAS RUTAS (GET, PUT, DELETE) ---
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre, apellido, email, telefono FROM usuarios');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT id, nombre, apellido, email, telefono FROM usuarios WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
