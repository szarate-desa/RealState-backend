
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { generateDescription } = require('../services/iaGenerateService');

// Endpoint para generar descripción de propiedad
router.post('/generate-description', authMiddleware, async (req, res) => {
  try {
    const { descripcion, latitud, longitud, audioUri, ciudadNombre, departamentoNombre } = req.body;
    const generatedData = await generateDescription({
      descripcion,
      latitud,
      longitud,
      audioUri,
      ciudadNombre,
      departamentoNombre,
    });

    res.json(generatedData);

  } catch (err) {
    const status = err.status || 500;
    console.error('Error al generar descripción con IA:', err);
    res.status(status).json({ error: err.message || 'Error interno del servidor al contactar la IA.' });
  }
});

module.exports = router;
