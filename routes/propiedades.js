const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { getOrCreateLocationIds } = require('../utils/locationHelper');
const authMiddleware = require('../middleware/authMiddleware');
const validateProperty = require('../validation/propertyValidation');

const multer = require('multer');
const path = require('path');

// Configuración de Multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no válido. Solo se permiten imágenes JPEG, PNG y WEBP.'), false);
    }
  }
});

// Obtener todas las propiedades (ruta pública con datos enriquecidos)
router.get('/', async (req, res) => {
  try {
    const query = `
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
      GROUP BY
        p.id,
        c.nombre,
        t.nombre,
        d.numero_habitaciones,
        d.numero_banos,
        u.latitud,
        u.longitud,
        u.direccion,
        u.barrio;
    `;

    const result = await pool.query(query);
    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching properties:', err);
    res.status(500).json({ error: 'Error al obtener las propiedades: ' + err.message });
  }
});

// ==================== MIS PROPIEDADES ====================
// IMPORTANTE: Estas rutas deben estar ANTES de '/:id' para evitar conflictos

// Obtener propiedades del usuario autenticado
router.get('/mis-propiedades', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { estado, tipo, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['p.id_propietario = $1'];
    const queryParams = [userId];
    let paramCount = 1;

    // Filtro por estado
    if (estado && estado !== 'all') {
      paramCount++;
      whereConditions.push(`p.estado_publicacion = $${paramCount}`);
      queryParams.push(estado);
    }

    // Filtro por tipo
    if (tipo && tipo !== 'all') {
      paramCount++;
      whereConditions.push(`ct.nombre = $${paramCount}`);
      queryParams.push(tipo);
    }

    const whereClause = whereConditions.join(' AND ');

    const query = `
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
        p.superficie_total,
        p.estado_publicacion,
        p.visitas,
        p.destacada,
        p.fecha_creacion,
        p.fecha_publicacion,
        p.expira_en,
        ct.nombre as tipo_inmueble,
        pu.latitud,
        pu.longitud,
        c.nombre as ciudad,
        d.nombre as departamento,
        pa.nombre as pais,
        ri.url_imagen as imagen_principal,
        (SELECT COUNT(*) FROM favoritos f WHERE f.id_propiedad = p.id) as total_favoritos
      FROM 
        propiedad p
        LEFT JOIN cat_inmueble_tipo ct ON p.id_inmueble_tipo = ct.id
        LEFT JOIN propiedad_ubicacion pu ON p.id_ubicacion = pu.id
        LEFT JOIN cat_ciudades c ON pu.id_ciudad = c.id
        LEFT JOIN cat_departamentos d ON c.id_departamento = d.id
        LEFT JOIN cat_paises pa ON d.id_pais = pa.id
        LEFT JOIN ranked_images ri ON p.id = ri.id_propiedad AND ri.rn = 1
      WHERE ${whereClause}
      ORDER BY p.fecha_creacion DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);

    // Contar total para paginación
    let countWhereConditions = ['p.id_propietario = $1'];
    let countParams = [userId];
    let countParamIndex = 1;
    
    if (estado && estado !== 'all') {
      countParamIndex++;
      countWhereConditions.push(`p.estado_publicacion = $${countParamIndex}`);
      countParams.push(estado);
    }
    
    if (tipo && tipo !== 'all') {
      countParamIndex++;
      countWhereConditions.push(`ct.nombre = $${countParamIndex}`);
      countParams.push(tipo);
    }
    
    const countWhereClause = countWhereConditions.join(' AND ');
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM propiedad p
      LEFT JOIN cat_inmueble_tipo ct ON p.id_inmueble_tipo = ct.id
      WHERE ${countWhereClause}
    `;

    const [properties, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, countParams)
    ]);

    res.json({
      properties: properties.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (err) {
    console.error('Error al obtener mis propiedades:', err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener propiedad por id (ruta pública)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
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
        (SELECT array_agg(url_imagen) FROM propiedad_imagenes WHERE id_propiedad = p.id) as imagenes
      FROM 
        propiedad p
        JOIN cat_inmueble_tipo t ON p.id_inmueble_tipo = t.id
        JOIN propiedad_ubicacion u ON p.id_ubicacion = u.id
        JOIN cat_ciudades c ON u.id_ciudad = c.id
        LEFT JOIN propiedad_detalles d ON p.id = d.id_propiedad
      WHERE p.id = $1
      GROUP BY
        p.id,
        c.nombre,
        t.nombre,
        d.numero_habitaciones,
        d.numero_banos,
        u.latitud,
        u.longitud,
        u.direccion,
        u.barrio;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cambiar estado de una propiedad (Mis Propiedades)
router.patch('/:id/estado', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const userId = req.user.id;

    // Validar estado
    const estadosValidos = ['activa', 'pausada', 'borrador', 'archivada'];
    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({ 
        error: 'Estado inválido. Valores permitidos: activa, pausada, borrador, archivada' 
      });
    }

    // Verificar que la propiedad pertenece al usuario
    const checkQuery = 'SELECT id FROM propiedad WHERE id = $1 AND id_propietario = $2';
    const checkResult = await pool.query(checkQuery, [id, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Propiedad no encontrada o no tienes permisos para modificarla' 
      });
    }

    // Actualizar estado
    const updateQuery = `
      UPDATE propiedad 
      SET estado_publicacion = $1, fecha_actualizacion = NOW()
      WHERE id = $2 
      RETURNING id, titulo, estado_publicacion
    `;
    
    const result = await pool.query(updateQuery, [estado, id]);

    res.json({ 
      message: 'Estado actualizado correctamente',
      propiedad: result.rows[0]
    });
  } catch (err) {
    console.error('Error al actualizar estado:', err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener estadísticas de una propiedad (Mis Propiedades)
router.get('/:id/estadisticas', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar que la propiedad pertenece al usuario
    const checkQuery = 'SELECT id FROM propiedad WHERE id = $1 AND id_propietario = $2';
    const checkResult = await pool.query(checkQuery, [id, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Propiedad no encontrada o no tienes permisos para ver sus estadísticas' 
      });
    }

    // Obtener estadísticas
    const statsQuery = `
      SELECT 
        p.visitas,
        p.fecha_creacion,
        p.fecha_publicacion,
        (SELECT COUNT(*) FROM favoritos f WHERE f.id_propiedad = p.id) as total_favoritos,
        (SELECT COUNT(*) FROM propiedad_imagenes pi WHERE pi.id_propiedad = p.id) as total_imagenes
      FROM propiedad p
      WHERE p.id = $1
    `;

    const statsResult = await pool.query(statsQuery, [id]);
    const stats = statsResult.rows[0];

    // Calcular días publicada
    const diasPublicada = stats.fecha_publicacion 
      ? Math.floor((Date.now() - new Date(stats.fecha_publicacion).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    res.json({
      visitas: stats.visitas || 0,
      favoritos: parseInt(stats.total_favoritos) || 0,
      imagenes: parseInt(stats.total_imagenes) || 0,
      diasPublicada,
      fechaCreacion: stats.fecha_creacion,
      fechaPublicacion: stats.fecha_publicacion,
      promedioVistasDiarias: diasPublicada > 0 ? ((stats.visitas || 0) / diasPublicada).toFixed(2) : 0
    });
  } catch (err) {
    console.error('Error al obtener estadísticas:', err);
    res.status(500).json({ error: err.message });
  }
});

// Insertar nueva propiedad (ruta protegida)
router.post('/', authMiddleware, validateProperty, async (req, res) => {
  console.log('--- INICIO CREACIÓN DE PROPIEDAD ---');
  console.log('Payload recibido:', req.body);

  const {
    id_ubicacion,
    id_inmueble_tipo,
    titulo,
    descripcion,
    precio_venta,
    precio_alquiler,
    superficie_total,
    numero_habitaciones,
    numero_banos
  } = req.body;
  const id_propietario = req.user.id;

  if (!id_ubicacion) {
    return res.status(400).json({ error: 'Falta el id_ubicacion.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Insertando propiedad en propiedad...');
    const propiedadResult = await client.query(
      'INSERT INTO propiedad (id_propietario, id_inmueble_tipo, id_ubicacion, titulo, descripcion, precio_venta, precio_alquiler, superficie_total) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [id_propietario, id_inmueble_tipo, id_ubicacion, titulo, descripcion, precio_venta, precio_alquiler, superficie_total]
    );
    const newPropiedadId = propiedadResult.rows[0].id;
    console.log('Propiedad insertada con ID:', newPropiedadId);

    console.log('Insertando detalles en propiedad_detalles...');
    await client.query(
      'INSERT INTO propiedad_detalles (id_propiedad, numero_habitaciones, numero_banos) VALUES ($1, $2, $3)',
      [newPropiedadId, numero_habitaciones, numero_banos]
    );
    console.log('Detalles de la propiedad insertados.');

    await client.query('COMMIT');
    console.log('--- FIN CREACIÓN DE PROPIEDAD ---');
    res.status(201).json({ id: newPropiedadId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al crear la propiedad:', err);
    res.status(500).json({ error: 'Error interno del servidor al crear la propiedad.' });
  } finally {
    client.release();
  }
});

// Actualizar propiedad existente (PUT) - Protegida
router.put('/:id', authMiddleware, validateProperty, async (req, res) => {
  console.log('--- INICIO ACTUALIZACIÓN DE PROPIEDAD ---');
  console.log('ID Propiedad:', req.params.id);
  console.log('Payload recibido:', req.body);

  const { id } = req.params;
  const {
    id_ubicacion,
    id_inmueble_tipo,
    titulo,
    descripcion,
    precio_venta,
    precio_alquiler,
    superficie_total,
    numero_habitaciones,
    numero_banos
  } = req.body;
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar que la propiedad pertenece al usuario
    const checkQuery = 'SELECT id FROM propiedad WHERE id = $1 AND id_propietario = $2';
    const checkResult = await client.query(checkQuery, [id, userId]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        error: 'Propiedad no encontrada o no tienes permisos para modificarla' 
      });
    }

    console.log('Actualizando propiedad...');
    await client.query(
      `UPDATE propiedad 
       SET id_inmueble_tipo = $1, 
           id_ubicacion = $2, 
           titulo = $3, 
           descripcion = $4, 
           precio_venta = $5, 
           precio_alquiler = $6, 
           superficie_total = $7,
           fecha_actualizacion = NOW()
       WHERE id = $8`,
      [id_inmueble_tipo, id_ubicacion, titulo, descripcion, precio_venta, precio_alquiler, superficie_total, id]
    );
    console.log('Propiedad actualizada.');

    console.log('Actualizando detalles de la propiedad...');
    // Verificar si existen detalles
    const detallesCheck = await client.query('SELECT id FROM propiedad_detalles WHERE id_propiedad = $1', [id]);
    
    if (detallesCheck.rows.length > 0) {
      // Actualizar detalles existentes
      await client.query(
        'UPDATE propiedad_detalles SET numero_habitaciones = $1, numero_banos = $2 WHERE id_propiedad = $3',
        [numero_habitaciones, numero_banos, id]
      );
    } else {
      // Insertar nuevos detalles
      await client.query(
        'INSERT INTO propiedad_detalles (id_propiedad, numero_habitaciones, numero_banos) VALUES ($1, $2, $3)',
        [id, numero_habitaciones, numero_banos]
      );
    }
    console.log('Detalles de la propiedad actualizados.');

    await client.query('COMMIT');
    console.log('--- FIN ACTUALIZACIÓN DE PROPIEDAD ---');
    res.json({ id, message: 'Propiedad actualizada correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar la propiedad:', err);
    res.status(500).json({ error: 'Error interno del servidor al actualizar la propiedad.' });
  } finally {
    client.release();
  }
});

// Eliminar propiedad (protegida, elimina registros relacionados en cascada lógica)
router.delete('/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await client.query('BEGIN');

    // Verificar existencia y propiedad del recurso
    const check = await client.query(
      'SELECT id, id_propietario FROM propiedad WHERE id = $1 AND id_propietario = $2',
      [id, userId]
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Propiedad no encontrada o no tienes permisos para eliminarla' });
    }

    // Eliminar dependencias relacionadas
    const delFavoritos = await client.query('DELETE FROM favoritos WHERE id_propiedad = $1', [id]);
    const delImagenes = await client.query('DELETE FROM propiedad_imagenes WHERE id_propiedad = $1', [id]);
    const delContactos = await client.query('DELETE FROM propiedad_contactos WHERE id_propiedad = $1', [id]);
    const delDetalles = await client.query('DELETE FROM propiedad_detalles WHERE id_propiedad = $1', [id]);

    // Eliminar propiedad principal (tabla correcta: propiedad)
    const delPropiedad = await client.query('DELETE FROM propiedad WHERE id = $1 RETURNING *', [id]);

    await client.query('COMMIT');

    return res.json({
      message: 'Propiedad eliminada correctamente',
      propiedad: delPropiedad.rows[0],
      eliminados: {
        favoritos: delFavoritos.rowCount,
        imagenes: delImagenes.rowCount,
        contactos: delContactos.rowCount,
        detalles: delDetalles.rowCount,
      }
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Error al eliminar la propiedad:', err);
    res.status(500).json({ error: 'Error interno del servidor al eliminar la propiedad.' });
  } finally {
    client.release();
  }
});

// Subir imágenes para una propiedad
router.post('/:id/imagenes', authMiddleware, async (req, res) => {
  const { id } = req.params;

  // Ejecutar multer y capturar errores para responder con 400 en vez de 500
  upload.array('files')(req, res, async (err) => {
    if (err) {
      // Errores de multer (tamaño, límites, etc.)
      if (err.name === 'MulterError') {
        let message = 'Error al procesar archivos.';
        if (err.code === 'LIMIT_FILE_SIZE') message = 'Archivo demasiado grande. Máximo 5MB.';
        if (err.code === 'LIMIT_UNEXPECTED_FILE') message = 'Campo inesperado. Se esperaba el campo "files".';
        return res.status(400).json({ error: message });
      }
      // Errores de validación del fileFilter (tipo no permitido)
      return res.status(400).json({ error: err.message || 'Tipo de archivo no permitido.' });
    }

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No se subieron archivos.' });
    }

    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const urls = [];
        for (const file of files) {
          const url_imagen = `/uploads/${file.filename}`;
          const result = await client.query(
            'INSERT INTO propiedad_imagenes (id_propiedad, url_imagen) VALUES ($1, $2) RETURNING url_imagen',
            [id, url_imagen]
          );
          urls.push(result.rows[0].url_imagen);
        }
        await client.query('COMMIT');
        return res.status(201).json({ urls });
      } catch (dbErr) {
        await client.query('ROLLBACK');
        console.error('Error insertando imágenes en BD:', dbErr);
        return res.status(500).json({ error: 'Error interno del servidor al guardar las imágenes.' });
      } finally {
        client.release();
      }
    } catch (connErr) {
      console.error('Error obteniendo conexión a BD:', connErr);
      return res.status(500).json({ error: 'Error interno del servidor al subir las imágenes.' });
    }
  });
});

// CRUD para propiedad_contactos
router.get('/:id/contactos', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM propiedad_contactos WHERE id_propiedad = $1`;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/contactos', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, email, tipo_contacto } = req.body;
    const query = `INSERT INTO propiedad_contactos (id_propiedad, nombre, telefono, email, tipo_contacto) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const result = await pool.query(query, [id, nombre, telefono, email, tipo_contacto]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/contactos/:contactoId', async (req, res) => {
  try {
    const { contactoId } = req.params;
    const { nombre, telefono, email, tipo_contacto } = req.body;
    const query = `UPDATE propiedad_contactos SET nombre = $1, telefono = $2, email = $3, tipo_contacto = $4 WHERE id = $5 RETURNING *`;
    const result = await pool.query(query, [nombre, telefono, email, tipo_contacto, contactoId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/contactos/:contactoId', async (req, res) => {
  try {
    const { contactoId } = req.params;
    const query = `DELETE FROM propiedad_contactos WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [contactoId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }
    res.json({ message: 'Contacto eliminado', contacto: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD para propiedad_detalles
router.get('/:id/detalles', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM propiedad_detalles WHERE id_propiedad = $1`;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/detalles', async (req, res) => {
  try {
    const { id } = req.params;
    const { numero_habitaciones, numero_banos, otros_detalles } = req.body;
    const query = `INSERT INTO propiedad_detalles (id_propiedad, numero_habitaciones, numero_banos, otros_detalles) VALUES ($1, $2, $3, $4) RETURNING *`;
    const result = await pool.query(query, [id, numero_habitaciones, numero_banos, otros_detalles]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/detalles/:detalleId', async (req, res) => {
  try {
    const { detalleId } = req.params;
    const { numero_habitaciones, numero_banos, otros_detalles } = req.body;
    const query = `UPDATE propiedad_detalles SET numero_habitaciones = $1, numero_banos = $2, otros_detalles = $3 WHERE id = $4 RETURNING *`;
    const result = await pool.query(query, [numero_habitaciones, numero_banos, otros_detalles, detalleId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Detalle no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/detalles/:detalleId', async (req, res) => {
  try {
    const { detalleId } = req.params;
    const query = `DELETE FROM propiedad_detalles WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [detalleId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Detalle no encontrado' });
    }
    res.json({ message: 'Detalle eliminado', detalle: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
