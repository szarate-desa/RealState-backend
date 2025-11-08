const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { getOrCreateLocationIds } = require('../utils/locationHelper');
const authMiddleware = require('../middleware/authMiddleware');
const validateProperty = require('../validation/propertyValidation');

const multer = require('multer');
const path = require('path');

// Configuración de Multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no válido. Solo se permiten imágenes JPEG y PNG.'), false);
    }
  }
});

// Obtener todas las propiedades (ruta pública con datos enriquecidos)
router.get('/', async (req, res) => {
  try {
    const query = `
      WITH ranked_images AS (
        SELECT 
          id_propiedad,
          url_imagen,
          ROW_NUMBER() OVER(PARTITION BY id_propiedad ORDER BY orden ASC, fecha_creacion ASC) as rn
        FROM 
          propiedad_imagenes
      )
      SELECT 
        p.id,
        p.titulo,
        p.descripcion,
        COALESCE(p.precio_venta, p.precio_alquiler) as precio,
        CASE 
          WHEN p.precio_venta IS NOT NULL THEN 'Venta'
          ELSE 'Alquiler'
        END as tipo_transaccion,
        u.latitud,
        u.longitud,
        u.direccion,
        u.barrio,
        c.nombre as ciudad,
        t.nombre as tipo_propiedad,
        d.numero_habitaciones,
        d.numero_banos,
        p.superficie_total,
        (SELECT url_imagen FROM ranked_images WHERE id_propiedad = p.id AND rn = 1) as imagen_principal,
        (SELECT array_agg(url_imagen) FROM ranked_images WHERE id_propiedad = p.id) as imagenes
      FROM 
        propiedad p
        JOIN cat_inmueble_tipo t ON p.id_inmueble_tipo = t.id
        JOIN propiedad_ubicacion u ON p.id_ubicacion = u.id
        JOIN cat_ciudades c ON u.id_ciudad = c.id
        LEFT JOIN propiedad_detalles d ON p.id = d.id_propiedad
      GROUP BY
        p.id,
        c.nombre,
        t.nombre,
        d.numero_habitaciones,
        d.numero_banos,
        u.latitud,
        u.longitud,
        u.direccion,
        u.barrio;
    `;

    const result = await pool.query(query);
    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching properties:', err);
    res.status(500).json({ error: 'Error al obtener las propiedades: ' + err.message });
  }
});

// Obtener propiedad por id (ruta pública)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        p.id,
        p.titulo,
        p.descripcion,
        COALESCE(p.precio_venta, p.precio_alquiler) as precio,
        CASE 
          WHEN p.precio_venta IS NOT NULL THEN 'Venta'
          ELSE 'Alquiler'
        END as tipo_transaccion,
        u.latitud,
        u.longitud,
        u.direccion,
        u.barrio,
        c.nombre as ciudad,
        t.nombre as tipo_propiedad,
        d.numero_habitaciones,
        d.numero_banos,
        p.superficie_total,
        (SELECT array_agg(url_imagen) FROM propiedad_imagenes WHERE id_propiedad = p.id) as imagenes
      FROM 
        propiedad p
        JOIN cat_inmueble_tipo t ON p.id_inmueble_tipo = t.id
        JOIN propiedad_ubicacion u ON p.id_ubicacion = u.id
        JOIN cat_ciudades c ON u.id_ciudad = c.id
        LEFT JOIN propiedad_detalles d ON p.id = d.id_propiedad
      WHERE p.id = $1
      GROUP BY
        p.id,
        c.nombre,
        t.nombre,
        d.numero_habitaciones,
        d.numero_banos,
        u.latitud,
        u.longitud,
        u.direccion,
        u.barrio;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Insertar nueva propiedad (ruta protegida)
router.post('/', authMiddleware, validateProperty, async (req, res) => {
  console.log('--- INICIO CREACIÓN DE PROPIEDAD ---');
  console.log('Payload recibido:', req.body);

  const {
    id_ubicacion,
    id_inmueble_tipo,
    titulo,
    descripcion,
    precio_venta,
    precio_alquiler,
    superficie_total,
    numero_habitaciones,
    numero_banos
  } = req.body;
  const id_propietario = req.user.id;

  if (!id_ubicacion) {
    return res.status(400).json({ error: 'Falta el id_ubicacion.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Insertando propiedad en propiedad...');
    const propiedadResult = await client.query(
      'INSERT INTO propiedad (id_propietario, id_inmueble_tipo, id_ubicacion, titulo, descripcion, precio_venta, precio_alquiler, superficie_total) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [id_propietario, id_inmueble_tipo, id_ubicacion, titulo, descripcion, precio_venta, precio_alquiler, superficie_total]
    );
    const newPropiedadId = propiedadResult.rows[0].id;
    console.log('Propiedad insertada con ID:', newPropiedadId);

    console.log('Insertando detalles en propiedad_detalles...');
    await client.query(
      'INSERT INTO propiedad_detalles (id_propiedad, numero_habitaciones, numero_banos) VALUES ($1, $2, $3)',
      [newPropiedadId, numero_habitaciones, numero_banos]
    );
    console.log('Detalles de la propiedad insertados.');

    await client.query('COMMIT');
    console.log('--- FIN CREACIÓN DE PROPIEDAD ---');
    res.status(201).json({ id: newPropiedadId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al crear la propiedad:', err);
    res.status(500).json({ error: 'Error interno del servidor al crear la propiedad.' });
  } finally {
    client.release();
  }
});

// Actualizar propiedad (ruta desprotegida por ahora)
router.put('/:id', validateProperty, async (req, res) => {
  const { id } = req.params;
  const { 
    id_inmueble_tipo, id_ciudad, titulo, descripcion, 
    precio_venta, precio_alquiler, direccion, barrio, codigo_postal, 
    latitud, longitud, superficie_total, numero_habitaciones, numero_banos
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const propiedadResult = await client.query(
      'UPDATE propiedades SET id_inmueble_tipo = $1, id_ciudad = $2, titulo = $3, descripcion = $4, precio_venta = $5, precio_alquiler = $6, direccion = $7, barrio = $8, codigo_postal = $9, latitud = $10, longitud = $11, superficie_total = $12 WHERE id = $13 RETURNING *',
      [id_inmueble_tipo, id_ciudad, titulo, descripcion, precio_venta, precio_alquiler, direccion, barrio, codigo_postal, latitud, longitud, superficie_total, id]
    );

    if (propiedadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    await client.query(
      'UPDATE propiedad_detalles SET numero_habitaciones = $1, numero_banos = $2 WHERE id_propiedad = $3',
      [numero_habitaciones, numero_banos, id]
    );

    await client.query('COMMIT');
    res.json(propiedadResult.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Eliminar propiedad (ruta desprotegida por ahora)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM propiedades WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }
    res.json({ message: 'Propiedad eliminada', propiedad: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Subir imágenes para una propiedad
router.post('/:id/imagenes', [authMiddleware, upload.array('files')], async (req, res) => {
  const { id } = req.params;
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No se subieron archivos.' });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const urls = [];
      for (const file of files) {
        const url_imagen = `/uploads/${file.filename}`;
        const result = await client.query(
          'INSERT INTO propiedad_imagenes (id_propiedad, url_imagen) VALUES ($1, $2) RETURNING url_imagen',
          [id, url_imagen]
        );
        urls.push(result.rows[0].url_imagen);
      }
      await client.query('COMMIT');
      res.status(201).json({ urls });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor al subir las imágenes.' });
  }
});

// CRUD para propiedad_contactos
router.get('/:id/contactos', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM propiedad_contactos WHERE id_propiedad = $1`;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/contactos', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, email, tipo_contacto } = req.body;
    const query = `INSERT INTO propiedad_contactos (id_propiedad, nombre, telefono, email, tipo_contacto) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const result = await pool.query(query, [id, nombre, telefono, email, tipo_contacto]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/contactos/:contactoId', async (req, res) => {
  try {
    const { contactoId } = req.params;
    const { nombre, telefono, email, tipo_contacto } = req.body;
    const query = `UPDATE propiedad_contactos SET nombre = $1, telefono = $2, email = $3, tipo_contacto = $4 WHERE id = $5 RETURNING *`;
    const result = await pool.query(query, [nombre, telefono, email, tipo_contacto, contactoId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/contactos/:contactoId', async (req, res) => {
  try {
    const { contactoId } = req.params;
    const query = `DELETE FROM propiedad_contactos WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [contactoId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }
    res.json({ message: 'Contacto eliminado', contacto: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD para propiedad_detalles
router.get('/:id/detalles', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM propiedad_detalles WHERE id_propiedad = $1`;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/detalles', async (req, res) => {
  try {
    const { id } = req.params;
    const { numero_habitaciones, numero_banos, otros_detalles } = req.body;
    const query = `INSERT INTO propiedad_detalles (id_propiedad, numero_habitaciones, numero_banos, otros_detalles) VALUES ($1, $2, $3, $4) RETURNING *`;
    const result = await pool.query(query, [id, numero_habitaciones, numero_banos, otros_detalles]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/detalles/:detalleId', async (req, res) => {
  try {
    const { detalleId } = req.params;
    const { numero_habitaciones, numero_banos, otros_detalles } = req.body;
    const query = `UPDATE propiedad_detalles SET numero_habitaciones = $1, numero_banos = $2, otros_detalles = $3 WHERE id = $4 RETURNING *`;
    const result = await pool.query(query, [numero_habitaciones, numero_banos, otros_detalles, detalleId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Detalle no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/detalles/:detalleId', async (req, res) => {
  try {
    const { detalleId } = req.params;
    const query = `DELETE FROM propiedad_detalles WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [detalleId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Detalle no encontrado' });
    }
    res.json({ message: 'Detalle eliminado', detalle: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
