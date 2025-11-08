const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Obtener todas las categorias de audio
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categorias_audio');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener categoria de audio por id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM categorias_audio WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría de audio no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Insertar nueva categoria de audio
router.post('/', async (req, res) => {
  try {
    const { codigo, descripcion, instruccion_ia } = req.body;
    const result = await pool.query(
      'INSERT INTO categorias_audio (codigo, descripcion, instruccion_ia) VALUES ($1, $2, $3) RETURNING *',
      [codigo, descripcion, instruccion_ia]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar categoria de audio
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, descripcion, instruccion_ia } = req.body;
    const result = await pool.query(
      'UPDATE categorias_audio SET codigo = $1, descripcion = $2, instruccion_ia = $3 WHERE id = $4 RETURNING *',
      [codigo, descripcion, instruccion_ia, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría de audio no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar categoria de audio
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM categorias_audio WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría de audio no encontrada' });
    }
    res.json({ message: 'Categoría de audio eliminada', categoria_audio: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
