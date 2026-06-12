const { Pool } = require('pg');

// Use Railway's DATABASE_URL environment variable with optimized pool settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Optimize for memory usage
  max: 5, // Reduce max connections from default 10
  min: 1, // Keep minimum connections low
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Allow time for Railway cold-start DB wake-up
  allowExitOnIdle: true // Allow process to exit when all connections are idle
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