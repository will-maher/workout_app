// Initialize the Postgres schema from ../schema.sql (idempotent:
// tables and indexes all use IF NOT EXISTS).
const fs = require('fs');
const path = require('path');
const { pool } = require('./database.pg');

async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database initialization completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

initializeDatabase();
