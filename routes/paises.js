const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Obtener todos los paises
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cat_paises');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener pais por id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM cat_paises WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'País no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Insertar nuevo pais
router.post('/', async (req, res) => {
  try {
    const { nombre } = req.body;
    const result = await pool.query(
      'INSERT INTO cat_paises (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar pais
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    const result = await pool.query(
      'UPDATE cat_paises SET nombre = $1 WHERE id = $2 RETURNING *',
      [nombre, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'País no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar pais
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM cat_paises WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'País no encontrado' });
    }
    res.json({ message: 'País eliminado', pais: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
