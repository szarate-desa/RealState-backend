const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Obtener todas las imagenes de una propiedad
router.get('/propiedad/:id_propiedad', async (req, res) => {
  try {
    const { id_propiedad } = req.params;
    const result = await pool.query('SELECT * FROM propiedad_imagenes WHERE id_propiedad = $1 ORDER BY orden', [id_propiedad]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener imagen por id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM propiedad_imagenes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Insertar nueva imagen
router.post('/', async (req, res) => {
  try {
    const { id_propiedad, url_imagen, descripcion_alt, orden } = req.body;
    const result = await pool.query(
      'INSERT INTO propiedad_imagenes (id_propiedad, url_imagen, descripcion_alt, orden) VALUES ($1, $2, $3, $4) RETURNING *',
      [id_propiedad, url_imagen, descripcion_alt, orden]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar imagen
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { url_imagen, descripcion_alt, orden } = req.body;
    const result = await pool.query(
      'UPDATE propiedad_imagenes SET url_imagen = $1, descripcion_alt = $2, orden = $3 WHERE id = $4 RETURNING *',
      [url_imagen, descripcion_alt, orden, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar imagen
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM propiedad_imagenes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    res.json({ message: 'Imagen eliminada', imagen: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
