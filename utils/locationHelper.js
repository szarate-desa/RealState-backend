const pool = require('../config/db');

/**
 * Busca o crea país, departamento y ciudad en la base de datos.
 * Devuelve los IDs correspondientes.
 * @param {string} paisNombre
 * @param {string} departamentoNombre
 * @param {string} ciudadNombre
 * @returns {Promise<{id_pais: number, id_departamento: number, id_ciudad: number}>}
 */
async function getOrCreateLocationIds(paisNombre, departamentoNombre, ciudadNombre) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 1. País
    let paisRes = await client.query('SELECT id FROM cat_paises WHERE LOWER(nombre) = LOWER($1) LIMIT 1', [paisNombre]);
    let id_pais;
    if (paisRes.rows.length > 0) {
      id_pais = paisRes.rows[0].id;
    } else {
      const insertPais = await client.query('INSERT INTO cat_paises (nombre) VALUES ($1) RETURNING id', [paisNombre]);
      id_pais = insertPais.rows[0].id;
    }
    // 2. Departamento
    let deptoRes = await client.query('SELECT id FROM cat_departamentos WHERE LOWER(nombre) = LOWER($1) AND id_pais = $2 LIMIT 1', [departamentoNombre, id_pais]);
    let id_departamento;
    if (deptoRes.rows.length > 0) {
      id_departamento = deptoRes.rows[0].id;
    } else {
      const insertDepto = await client.query('INSERT INTO cat_departamentos (nombre, id_pais) VALUES ($1, $2) RETURNING id', [departamentoNombre, id_pais]);
      id_departamento = insertDepto.rows[0].id;
    }
    // 3. Ciudad
    let ciudadRes = await client.query('SELECT id FROM cat_ciudades WHERE LOWER(nombre) = LOWER($1) AND id_departamento = $2 LIMIT 1', [ciudadNombre, id_departamento]);
    let id_ciudad;
    if (ciudadRes.rows.length > 0) {
      id_ciudad = ciudadRes.rows[0].id;
    } else {
      const insertCiudad = await client.query('INSERT INTO cat_ciudades (nombre, id_departamento) VALUES ($1, $2) RETURNING id', [ciudadNombre, id_departamento]);
      id_ciudad = insertCiudad.rows[0].id;
    }
    await client.query('COMMIT');
    return { id_pais, id_departamento, id_ciudad };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getOrCreateLocationIds };
