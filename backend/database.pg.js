const { Pool } = require('pg');

const pool = new Pool({
  user: 'workout_user',
  host: 'localhost',
  database: 'workout_app',
  password: 'workout_pass',
  port: 5432,
});

module.exports = { pool }; 