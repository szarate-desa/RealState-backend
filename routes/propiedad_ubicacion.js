const express = require('express');
const router = express.Router();
const { getOrCreateLocationIds } = require('../utils/locationHelper');

// Validar/crear ubicación (país, departamento, ciudad) y devolver los IDs
router.post('/', async (req, res) => {
  const { paisNombre, departamentoNombre, ciudadNombre, direccion, barrio, latitud, longitud, codigo_postal } = req.body;
  console.log('--- INICIO CREACIÓN UBICACIÓN ---');
  console.log('Datos recibidos:', req.body);
  if (!paisNombre || !departamentoNombre || !ciudadNombre || !direccion || !latitud || !longitud) {
    console.log('Validación fallida: faltan datos obligatorios.');
    return res.status(400).json({ error: 'Faltan datos de ubicación: país, departamento, ciudad, dirección, latitud o longitud.' });
  }
  const pool = require('../config/db');
  try {
    const ids = await getOrCreateLocationIds(paisNombre, departamentoNombre, ciudadNombre);
    console.log('IDs de país/departamento/ciudad:', ids);
    // Crear registro en propiedad_ubicacion
    const result = await pool.query(
      'INSERT INTO propiedad_ubicacion (direccion, barrio, id_ciudad, latitud, longitud, codigo_postal) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [direccion, barrio || null, ids.id_ciudad, latitud, longitud, codigo_postal || null]
    );
    const id_ubicacion = result.rows[0].id;
    console.log('Ubicación insertada con ID:', id_ubicacion);
    console.log('--- FIN CREACIÓN UBICACIÓN ---');
    res.json({ id_ubicacion, ...ids });
  } catch (err) {
    console.error('Error en validación/creación de ubicación:', err);
    res.status(500).json({ error: 'No se pudo validar o crear la ubicación.' });
  }
});

module.exports = router;
