const { Pool } = require('pg');

// Use Railway's DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:lGfkSJJrCJTrdhiohAOpwDkDzKNowCgp@mainline.proxy.rlwy.net:32539/railway',
  ssl: { rejectUnauthorized: false }
});

// Test the connection
pool.on('connect', () => {
  console.log('Connected to Postgres database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = { pool }; 