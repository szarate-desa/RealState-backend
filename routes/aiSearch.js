const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { parseNaturalLanguageQuery, buildFilterQuery } = require('../services/aiSearchService');

/**
 * POST /ai-search
 * Búsqueda inteligente por lenguaje natural
 * Body: { query: "departamento con balcón cerca de la universidad, menos de 400 USD" }
 */
router.post('/', async (req, res) => {
  try {
    const { query, limit = 20, offset = 0 } = req.body;

    if (!query || query.trim().length === 0) {
      console.warn('[AI-Search] Query vacía en request');
      return res.status(400).json({
        error: 'La consulta no puede estar vacía',
      });
    }

    console.log(`[AI-Search] Iniciando búsqueda con query: "${query}"`);

    // Paso 1: Analizar la consulta con IA
    const filters = await parseNaturalLanguageQuery(query);

    if (!filters) {
      console.warn(`[AI-Search] No se pudieron extraer filtros de: "${query}"`);
      return res.status(400).json({
        error: 'No se pudo entender la consulta. Intenta con otra descripción.',
      });
    }

    console.log(`[AI-Search] Filtros extraídos con éxito:`, JSON.stringify(filters, null, 2));

    // Paso 2: Construir consulta SQL con los filtros
    const whereClause = buildFilterQuery(filters);
    console.log(`[AI-Search] WHERE clause generado: ${whereClause}`);

    // Paso 3: Ejecutar consulta con los filtros extraídos
    const searchQuery = `
      WITH ranked_images AS (
        SELECT 
          id_propiedad,
          url_imagen,
          ROW_NUMBER() OVER(PARTITION BY id_propiedad ORDER BY orden ASC, fecha_creacion ASC) as rn
        FROM 
          propiedad_imagenes
      )
      SELECT 
        p.id,
        p.titulo,
        p.descripcion,
        COALESCE(p.precio_venta, p.precio_alquiler) as precio,
        CASE 
          WHEN p.precio_venta IS NOT NULL THEN 'Venta'
          ELSE 'Alquiler'
        END as tipo_transaccion,
        u.latitud,
        u.longitud,
        u.direccion,
        u.barrio,
        c.nombre as ciudad,
        t.nombre as tipo_propiedad,
        d.numero_habitaciones,
        d.numero_banos,
        p.superficie_total,
        (SELECT url_imagen FROM ranked_images WHERE id_propiedad = p.id AND rn = 1) as imagen_principal,
        (SELECT array_agg(url_imagen) FROM ranked_images WHERE id_propiedad = p.id) as imagenes
      FROM 
        propiedad p
        JOIN cat_inmueble_tipo t ON p.id_inmueble_tipo = t.id
        JOIN propiedad_ubicacion u ON p.id_ubicacion = u.id
        JOIN cat_ciudades c ON u.id_ciudad = c.id
        LEFT JOIN propiedad_detalles d ON p.id = d.id_propiedad
      ${whereClause}
      GROUP BY
        p.id,
        c.nombre,
        t.nombre,
        d.numero_habitaciones,
        d.numero_banos,
        u.latitud,
        u.longitud,
        u.direccion,
        u.barrio
      ORDER BY p.fecha_creacion DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(searchQuery, [limit, offset]);

    console.log(`[AI-Search] Búsqueda exitosa. Encontrados ${result.rows.length} resultados`);

    // Paso 4: Retornar resultados con metadata de los filtros aplicados
    res.json({
      success: true,
      appliedFilters: {
        original_query: query,
        extracted_filters: filters,
      },
      results: result.rows,
      count: result.rows.length,
      offset,
      limit,
    });
  } catch (error) {
    console.error('[AI-Search] Error en búsqueda IA:', error.message);
    console.error('[AI-Search] Stack trace:', error.stack);
    res.status(500).json({
      error: 'Error al procesar la búsqueda inteligente',
      details: error.message,
    });
  }
});

/**
 * POST /ai-search/explain
 * Explica qué filtros se extrajeron sin hacer la búsqueda
 * Útil para debugging y feedback del usuario
 */
router.post('/explain', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'La consulta no puede estar vacía',
      });
    }

    const filters = await parseNaturalLanguageQuery(query);

    if (!filters) {
      return res.status(400).json({
        error: 'No se pudo entender la consulta.',
      });
    }

    // Generar explicación en texto plano
    const explanations = [];

    if (filters.tipo_propiedad) {
      explanations.push(`📦 Tipo: ${filters.tipo_propiedad}`);
    }
    if (filters.tipo_transaccion) {
      explanations.push(`🏷️ ${filters.tipo_transaccion}`);
    }
    if (filters.precio_min || filters.precio_max) {
      const min = filters.precio_min || 'sin mínimo';
      const max = filters.precio_max || 'sin máximo';
      explanations.push(`💵 Precio: $${min} - $${max}`);
    }
    if (filters.superficie_min || filters.superficie_max) {
      const min = filters.superficie_min || 'sin mínimo';
      const max = filters.superficie_max || 'sin máximo';
      explanations.push(`📐 Superficie: ${min}m² - ${max}m²`);
    }
    if (filters.habitaciones_min) {
      explanations.push(`🛏️ Al menos ${filters.habitaciones_min} habitaciones`);
    }
    if (filters.banos_min) {
      explanations.push(`🚿 Al menos ${filters.banos_min} baños`);
    }
    if (filters.amenities && filters.amenities.length > 0) {
      explanations.push(`✨ Amenities: ${filters.amenities.join(', ')}`);
    }
    if (filters.ubicacion_palabra_clave) {
      explanations.push(`📍 Ubicación: ${filters.ubicacion_palabra_clave}`);
    }

    res.json({
      success: true,
      query,
      extracted_filters: filters,
      explanations,
      message: 'Estos son los filtros que entendí de tu búsqueda',
    });
  } catch (error) {
    console.error('Error en explicación IA:', error);
    res.status(500).json({
      error: 'Error al procesar la consulta',
      details: error.message,
    });
  }
});

module.exports = router;
