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

    // Crear y firmar un token JWT
    const payload = {
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido
      }
    };

    const jwtSecret = process.env.JWT_SECRET || 'YOUR_JWT_SECRET';

    jwt.sign(payload, jwtSecret, { expiresIn: '1h' }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
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
