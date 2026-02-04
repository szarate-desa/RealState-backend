const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const resolveDepartamentoId = async (departamentoNombre) => {
  if (!departamentoNombre) return null;

  const departamentoResult = await pool.query(
    'SELECT id FROM cat_departamentos WHERE nombre = $1',
    [departamentoNombre]
  );

  if (departamentoResult.rows.length > 0) {
    return departamentoResult.rows[0].id;
  }

  const newDepartamentoResult = await pool.query(
    'INSERT INTO cat_departamentos (nombre) VALUES ($1) RETURNING id',
    [departamentoNombre]
  );

  return newDepartamentoResult.rows[0].id;
};

const resolveCiudadId = async (ciudadNombre, idDepartamento) => {
  if (!ciudadNombre || !idDepartamento) return null;

  const ciudadResult = await pool.query(
    'SELECT id FROM cat_ciudades WHERE nombre = $1 AND id_departamento = $2',
    [ciudadNombre, idDepartamento]
  );

  if (ciudadResult.rows.length > 0) {
    return ciudadResult.rows[0].id;
  }

  const newCiudadResult = await pool.query(
    'INSERT INTO cat_ciudades (nombre, id_departamento) VALUES ($1, $2) RETURNING id',
    [ciudadNombre, idDepartamento]
  );

  return newCiudadResult.rows[0].id;
};

const buildPrompt = ({ textoBase, latitud, longitud }) => {
  return `
    Actúa como un experto en marketing inmobiliario y copywriting.
    Tu tarea es crear un anuncio de venta atractivo, profesional y VISUALMENTE ESTRUCTURADO para una propiedad.
    
    Utiliza la siguiente información proporcionada por el usuario:
    - Descripción base: "${textoBase}"
    - Ubicación (coordenadas): Latitud ${latitud}, Longitud ${longitud}

    IMPORTANTE - FORMATO DE LA DESCRIPCIÓN:
    La descripción debe estar en formato HTML con la siguiente estructura:
    
    1. Un párrafo inicial breve y emocional (2-3 líneas) que capte la atención
    2. Secciones organizadas con <h3> para subtítulos y contenido estructurado:
       - Usar <strong> para destacar datos importantes
       - Usar <ul> y <li> para listas de características
       - Usar <p> para párrafos separados
       - Dejar espacios en blanco entre secciones
    
    Ejemplo de estructura deseada:
    <p>Párrafo inicial emocional que enganche...</p>
    
    <h3>✨ Características Destacadas</h3>
    <ul>
      <li><strong>Dato clave:</strong> descripción</li>
      <li><strong>Otro dato:</strong> descripción</li>
    </ul>
    
    <h3>🏡 Distribución y Espacios</h3>
    <p>Descripción de ambientes...</p>
    
    <h3>📍 Ubicación y Entorno</h3>
    <p>Beneficios del barrio, cercanías...</p>
    
    El título debe ser conciso pero impactante, máximo 10 palabras.
    Incluir en el título: característica única + zona + dato relevante.
    
    Devuelve el resultado en formato JSON con la siguiente estructura:
    {
      "titulo_generado": "Título conciso y atractivo",
      "descripcion_generada": "Descripción completa en HTML con estructura visual"
    }
  `;
};

const parseJsonFromText = (text) => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('La respuesta de la IA no contenía un JSON válido.');
  }
  return JSON.parse(jsonMatch[0]);
};

const generateDescription = async ({
  descripcion,
  latitud,
  longitud,
  audioUri,
  ciudadNombre,
  departamentoNombre,
}) => {
  if (!descripcion && !audioUri) {
    const error = new Error('Se requiere una descripción o un audio.');
    error.status = 400;
    throw error;
  }

  const id_departamento = await resolveDepartamentoId(departamentoNombre);
  const id_ciudad = await resolveCiudadId(ciudadNombre, id_departamento);

  let textoBase = descripcion;

  // Placeholder para transcripción de audio
  if (audioUri) {
    textoBase = `Transcripción simulada del audio: ${audioUri}`;
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  const prompt = buildPrompt({ textoBase, latitud, longitud });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  const generatedData = parseJsonFromText(text);

  return {
    ...generatedData,
    id_ciudad,
    id_departamento,
  };
};

module.exports = {
  generateDescription,
};
