const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Obtener todos los favoritos de un usuario
router.get('/usuario/:id_usuario', async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const result = await pool.query('SELECT * FROM favoritos WHERE id_usuario = $1', [id_usuario]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Añadir un favorito
router.post('/', async (req, res) => {
  try {
    const { id_usuario, id_propiedad } = req.body;
    const result = await pool.query(
      'INSERT INTO favoritos (id_usuario, id_propiedad) VALUES ($1, $2) RETURNING *',
      [id_usuario, id_propiedad]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar un favorito
router.delete('/', async (req, res) => {
  try {
    const { id_usuario, id_propiedad } = req.body;
    const result = await pool.query('DELETE FROM favoritos WHERE id_usuario = $1 AND id_propiedad = $2 RETURNING *', [id_usuario, id_propiedad]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Favorito no encontrado' });
    }
    res.json({ message: 'Favorito eliminado', favorito: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
