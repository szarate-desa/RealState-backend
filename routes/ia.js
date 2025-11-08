
const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db');

// Asegúrate de tener tu API Key en las variables de entorno
// IMPORTANT: Make sure to set the GEMINI_API_KEY environment variable.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Endpoint para generar descripción de propiedad
router.post('/generate-description', authMiddleware, async (req, res) => {
  try {
    const { descripcion, latitud, longitud, audioUri, ciudadNombre, departamentoNombre } = req.body;

    let id_departamento_final = null;
    if (departamentoNombre) {
      let departamentoResult = await pool.query('SELECT id FROM departamentos WHERE nombre = $1', [departamentoNombre]);
      if (departamentoResult.rows.length > 0) {
        id_departamento_final = departamentoResult.rows[0].id;
      } else {
        const newDepartamentoResult = await pool.query('INSERT INTO departamentos (nombre) VALUES ($1) RETURNING id', [departamentoNombre]);
        id_departamento_final = newDepartamentoResult.rows[0].id;
      }
    }

    let id_ciudad_final = null;
    if (ciudadNombre && id_departamento_final) {
      let ciudadResult = await pool.query('SELECT id FROM cat_ciudades WHERE nombre = $1 AND id_departamento = $2', [ciudadNombre, id_departamento_final]);
      if (ciudadResult.rows.length > 0) {
        id_ciudad_final = ciudadResult.rows[0].id;
      } else {
        const newCiudadResult = await pool.query('INSERT INTO cat_ciudades (nombre, id_departamento) VALUES ($1, $2) RETURNING id', [ciudadNombre, id_departamento_final]);
        id_ciudad_final = newCiudadResult.rows[0].id;
      }
    }

    debugger;

    if (!descripcion && !audioUri) {
      return res.status(400).json({ error: 'Se requiere una descripción o un audio.' });
    }

    let textoBase = descripcion;

    // --- Placeholder para Transcripción de Audio ---
    // Si se proporciona un audioUri, aquí iría la lógica para:
    // 1. Descargar el archivo de audio.
    // 2. Enviarlo a un servicio de transcripción (como Google Speech-to-Text o el propio Gemini).
    // 3. Usar el texto transcrito como 'textoBase'.
    if (audioUri) {
      // Por ahora, simulamos una transcripción
      textoBase = "Transcripción simulada del audio: " + audioUri;
    }
    // --- Fin del Placeholder ---

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const prompt = `
      Actúa como un experto en marketing inmobiliario.
      Tu tarea es crear un anuncio de venta atractivo y profesional para una propiedad.
      
      Utiliza la siguiente información proporcionada por el usuario:
      - Descripción base: "${textoBase}"
      - Ubicación (coordenadas): Latitud ${latitud}, Longitud ${longitud}

      Basado en estos datos, genera una descripción mejorada y un título llamativo.
      La descripción debe ser elocuente, destacar los puntos fuertes que puedas inferir y estar bien estructurada.
      Si la descripción base es muy escueta, usa la ubicación para inferir posibles atractivos (ej. "cerca de zonas verdes", "en un área tranquila", etc.), pero siempre como sugerencia.

      Devuelve el resultado en formato JSON con la siguiente estructura:
      {
        "titulo_generado": "Un título para el anuncio",
        "descripcion_generada": "Un párrafo con la descripción del anuncio."
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Limpiar y parsear la respuesta JSON del modelo de forma robusta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("La respuesta de la IA no contenía un JSON válido.");
    }
    const jsonString = jsonMatch[0];
    const generatedData = JSON.parse(jsonString);

    res.json({
      ...generatedData,
      id_ciudad: id_ciudad_final,
      id_departamento: id_departamento_final,
    });

  } catch (err) {
    console.error("Error al generar descripción con IA:", err);
    res.status(500).json({ error: 'Error interno del servidor al contactar la IA.' });
  }
});

module.exports = router;
