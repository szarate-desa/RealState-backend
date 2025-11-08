const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Obtener todos los departamentos
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cat_departamentos');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener departamento por id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM cat_departamentos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Departamento no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Insertar nuevo departamento
router.post('/', async (req, res) => {
  try {
    const { nombre, id_pais } = req.body;
    const result = await pool.query(
      'INSERT INTO cat_departamentos (nombre, id_pais) VALUES ($1, $2) RETURNING *',
      [nombre, id_pais]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar departamento
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, id_pais } = req.body;
    const result = await pool.query(
      'UPDATE cat_departamentos SET nombre = $1, id_pais = $2 WHERE id = $3 RETURNING *',
      [nombre, id_pais, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Departamento no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar departamento
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM cat_departamentos WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Departamento no encontrado' });
    }
    res.json({ message: 'Departamento eliminado', departamento: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;