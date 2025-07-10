const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { pool } = require('./database.pg');

const authRoutes = require('./routes/auth');
const exercisesRoutes = require('./routes/exercises');
const workoutsRoutes = require('./routes/workouts');
const planRoutes = require('./routes/plan');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(bodyParser.json());

app.use('/api/auth', authRoutes);
app.use('/api/exercises', exercisesRoutes);
app.use('/api/workouts', workoutsRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/stats', statsRoutes);

app.get('/', (req, res) => {
  res.send('Workout App API running with Postgres!');
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    res.json({
      message: 'Database connection successful',
      current_time: result.rows[0].current_time,
      db_version: result.rows[0].db_version
    });
  } catch (err) {
    console.error('Database connection test failed:', err);
    res.status(500).json({
      error: 'Database connection failed',
      details: err.message
    });
  }
});

// Test database structure
app.get('/api/test-structure', async (req, res) => {
  try {
    const tables = ['users', 'exercises', 'workouts', 'workout_sets', 'plans'];
    const results = {};
    
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        results[table] = { exists: true, count: result.rows[0].count };
      } catch (err) {
        results[table] = { exists: false, error: err.message };
      }
    }
    
    res.json({
      message: 'Database structure check',
      tables: results
    });
  } catch (err) {
    console.error('Database structure test failed:', err);
    res.status(500).json({
      error: 'Database structure test failed',
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 