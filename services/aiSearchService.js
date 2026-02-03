const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Servicio de búsqueda inteligente usando Gemini AI
 * Convierte consultas en lenguaje natural a filtros estructurados
 */

const GEMINI_PROMPT_TEMPLATE = `
Eres un experto analizador de consultas inmobiliarias en español. Tu tarea es extraer información estructurada de una consulta en lenguaje natural.

CONSULTA DEL USUARIO: "{query}"

Analiza la consulta y extrae ÚNICAMENTE los siguientes parámetros si están presentes:

1. "tipo_propiedad": tipo de inmueble buscado. Valores válidos:
   - Apartamento (también: departamento, dpto, apto, piso, flat)
   - Casa (también: vivienda, residencia, hogar)
   - Oficina (también: despacho, comercio)
   - Local (también: tienda, negocio, retail)
   - Terreno (también: lote, solar, parcela, tierra)
   - Estudio (también: mini apartamento, monoambiente, T1)
   - null si no está claro
   
2. "amenities": array de comodidades buscadas (de cualquier tipo mencionado):
   Ejemplos: balcón, jardín, piscina, estacionamiento, ascensor, aire_acondicionado, wifi, cocina_integral, terraza, gym, cochera, vigilancia, parque, vista, desayunador, lavadero

3. "precio_max": número en USD (null si no está especificado)
4. "precio_min": número en USD (null si no está especificado)
5. "superficie_min": número en m² (null si no está)
6. "superficie_max": número en m² (null si no está)
7. "habitaciones_min": número (null si no está)
8. "banos_min": número (null si no está)
9. "tipo_transaccion": "Venta" o "Alquiler" (inferir del contexto, null si ambiguo)
10. "ubicacion_palabra_clave": palabras clave de ubicación específicas (ej: "universidad", "centro", "zona alta", "cerca escuela") o null

INSTRUCCIONES CRÍTICAS:
1. Sé inteligente con abreviaturas: m2/m²=metros cuadrados, dorm/hab/cuarto=habitación, ba/wc=baño
2. Si el usuario menciona moneda, interpreta realista (USD 400 = 400, MXN 400000 ≈ 24000 USD)
3. Si dice "terreno", "lote", "solar" → tipo_propiedad = "Terreno"
4. Si dice "apartamento", "departamento", "dpto", "piso" → tipo_propiedad = "Apartamento"
5. RETORNA SOLO JSON válido, sin explicaciones adicionales

EJEMPLO 1:
Entrada: "departamento con balcón cerca de la universidad, menos de 400 USD"
Salida: {"tipo_propiedad": "Apartamento", "amenities": ["balcón"], "precio_max": 400, "precio_min": null, "superficie_min": null, "superficie_max": null, "habitaciones_min": null, "banos_min": null, "tipo_transaccion": "Alquiler", "ubicacion_palabra_clave": "universidad"}

EJEMPLO 2:
Entrada: "busco un terreno para construir, 5000 m2 minimo"
Salida: {"tipo_propiedad": "Terreno", "amenities": [], "precio_max": null, "precio_min": null, "superficie_min": 5000, "superficie_max": null, "habitaciones_min": null, "banos_min": null, "tipo_transaccion": null, "ubicacion_palabra_clave": null}

RETORNA SOLO EL JSON:
`;

/**
 * Analiza una consulta natural y extrae filtros
 */
async function parseNaturalLanguageQuery(query) {
  try {
    if (!query || query.trim().length === 0) {
      console.warn('[AI] Query vacía recibida');
      return null;
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('[AI] GEMINI_API_KEY no está definida en .env');
      return null;
    }

    console.log(`[AI] Parsing query: "${query}"`);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const prompt = GEMINI_PROMPT_TEMPLATE.replace('{query}', query);

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log(`[AI] Respuesta de Gemini: ${responseText.substring(0, 200)}...`);

    // Intenta extraer JSON de la respuesta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[AI] No JSON encontrado en respuesta Gemini. Respuesta completa:', responseText);
      return null;
    }

    const filters = JSON.parse(jsonMatch[0]);
    console.log('[AI] Filtros extraídos:', JSON.stringify(filters, null, 2));

    return {
      ...filters,
      query: query, // Guardar query original para logging
    };
  } catch (error) {
    console.error('[AI] Error al parsear consulta con Gemini:', error.message);
    console.error('[AI] Stack trace:', error.stack);
    // En caso de error al parsear o al llamar a la IA, devolver null para que el endpoint responda 400
    return null;
  }
}

/**
 * Construye una consulta SQL donde basada en los filtros extraídos
 * Soporta búsqueda en titulo, descripcion, tipo_propiedad, precio, superficie, habitaciones, baños, amenities y ubicación
 */
function buildFilterQuery(filters) {
  const conditions = [];

  // Búsqueda por tipo de propiedad en tabla cat_inmueble_tipo Y en titulo/descripcion
  if (filters.tipo_propiedad) {
    const propType = filters.tipo_propiedad.replace(/'/g, "''");
    conditions.push(
      `(t.nombre ILIKE '${propType}' OR p.titulo ILIKE '%${propType}%' OR p.descripcion ILIKE '%${propType}%')`
    );
  }

  // Rango de precio (mínimo)
  if (filters.precio_min !== null && filters.precio_min !== undefined) {
    conditions.push(
      `COALESCE(p.precio_venta, p.precio_alquiler) >= ${filters.precio_min}`
    );
  }

  // Rango de precio (máximo)
  if (filters.precio_max !== null && filters.precio_max !== undefined) {
    conditions.push(
      `COALESCE(p.precio_venta, p.precio_alquiler) <= ${filters.precio_max}`
    );
  }

  // Tipo de transacción (Venta o Alquiler)
  if (filters.tipo_transaccion) {
    const hasVenta = filters.tipo_transaccion === 'Venta';
    conditions.push(
      `${hasVenta ? 'p.precio_venta IS NOT NULL' : 'p.precio_alquiler IS NOT NULL'}`
    );
  }

  // Superficie mínima
  if (filters.superficie_min) {
    conditions.push(`p.superficie_total >= ${filters.superficie_min}`);
  }

  // Superficie máxima
  if (filters.superficie_max) {
    conditions.push(`p.superficie_total <= ${filters.superficie_max}`);
  }

  // Número mínimo de habitaciones
  if (filters.habitaciones_min) {
    conditions.push(`d.numero_habitaciones >= ${filters.habitaciones_min}`);
  }

  // Número mínimo de baños
  if (filters.banos_min) {
    conditions.push(`d.numero_banos >= ${filters.banos_min}`);
  }

  // Amenities: busca en descripción de propiedad (parque, piscina, ascensor, etc.)
  if (filters.amenities && filters.amenities.length > 0) {
    const amenityConditions = filters.amenities
      .map(a => {
        const escaped = String(a).replace(/'/g, "''");
        // Busca en titulo Y descripcion para mayor cobertura
        return `(p.titulo ILIKE '%${escaped}%' OR p.descripcion ILIKE '%${escaped}%')`;
      })
      .join(' OR ');
    conditions.push(`(${amenityConditions})`);
  }

  // Palabra clave de ubicación: busca en dirección, barrio y ciudad
  if (filters.ubicacion_palabra_clave) {
    const locationKeyword = filters.ubicacion_palabra_clave.replace(/'/g, "''");
    conditions.push(
      `(u.direccion ILIKE '%${locationKeyword}%' OR u.barrio ILIKE '%${locationKeyword}%' OR c.nombre ILIKE '%${locationKeyword}%')`
    );
  }

  // Construcción final del WHERE clause
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  
  console.log('[buildFilterQuery] Condiciones generadas:', conditions);
  console.log('[buildFilterQuery] WHERE clause final:', whereClause);
  
  return whereClause;
}

module.exports = {
  parseNaturalLanguageQuery,
  buildFilterQuery,
};
