const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Obtener todos los procesamientos de audio
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM procesamientos_audio');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener procesamiento de audio por id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM procesamientos_audio WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Procesamiento de audio no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Insertar nuevo procesamiento de audio
router.post('/', async (req, res) => {
  try {
    const { id_usuario, id_categoria_audio, id_propiedad, url_audio, estado, texto_transcrito, descripcion_generada, error_mensaje } = req.body;
    const result = await pool.query(
      'INSERT INTO procesamientos_audio (id_usuario, id_categoria_audio, id_propiedad, url_audio, estado, texto_transcrito, descripcion_generada, error_mensaje) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [id_usuario, id_categoria_audio, id_propiedad, url_audio, estado, texto_transcrito, descripcion_generada, error_mensaje]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar procesamiento de audio
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, texto_transcrito, descripcion_generada, error_mensaje } = req.body;
    const result = await pool.query(
      'UPDATE procesamientos_audio SET estado = $1, texto_transcrito = $2, descripcion_generada = $3, error_mensaje = $4 WHERE id = $5 RETURNING *',
      [estado, texto_transcrito, descripcion_generada, error_mensaje, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Procesamiento de audio no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar procesamiento de audio
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM procesamientos_audio WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Procesamiento de audio no encontrado' });
    }
    res.json({ message: 'Procesamiento de audio eliminado', procesamiento_audio: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
