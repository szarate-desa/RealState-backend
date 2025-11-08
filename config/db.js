const { Pool } = require('pg');

// Usar la cadena de conexión directamente
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_1gNdiuwMez8R@ep-royal-water-acky8gso-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;
