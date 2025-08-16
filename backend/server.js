require('dotenv').config();
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

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exercises', exercisesRoutes);
app.use('/api/workouts', workoutsRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/stats', statsRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Workout App API running with Postgres!',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Database connection test
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    res.json({
      status: 'healthy',
      database: 'connected',
      current_time: result.rows[0].current_time,
      db_version: result.rows[0].db_version
    });
  } catch (err) {
    console.error('Database connection test failed:', err);
    res.status(503).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: 'Database connection failed'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} on all interfaces`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 