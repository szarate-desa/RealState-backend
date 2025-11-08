const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Obtener todas las ciudades
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cat_ciudades');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener ciudad por id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM cat_ciudades WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ciudad no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Insertar nueva ciudad
router.post('/', async (req, res) => {
  try {
    const { nombre, id_departamento } = req.body;
    const result = await pool.query(
      'INSERT INTO cat_ciudades (nombre, id_departamento) VALUES ($1, $2) RETURNING *',
      [nombre, id_departamento]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar ciudad
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, id_departamento } = req.body;
    const result = await pool.query(
      'UPDATE cat_ciudades SET nombre = $1, id_departamento = $2 WHERE id = $3 RETURNING *',
      [nombre, id_departamento, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ciudad no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar ciudad
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM cat_ciudades WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ciudad no encontrada' });
    }
    res.json({ message: 'Ciudad eliminada', ciudad: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
