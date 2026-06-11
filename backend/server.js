require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { pool } = require('./database.pg');
const { logMemoryUsage } = require('./memory-monitor');

const authRoutes = require('./routes/auth');
const exercisesRoutes = require('./routes/exercises');
const workoutsRoutes = require('./routes/workouts');
const planRoutes = require('./routes/plan');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 5001;

// Behind Railway's proxy: trust the first hop so client IPs come from
// X-Forwarded-For (required by express-rate-limit).
app.set('trust proxy', 1);

// Middleware
// CSP is disabled because CRA inlines its runtime chunk in index.html,
// which the default helmet policy would block.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json());

// Rate limit auth endpoints to slow down credential guessing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' },
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/exercises', exercisesRoutes);
app.use('/api/workouts', workoutsRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/stats', statsRoutes);

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

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Serve the frontend build (single-service deployment). Hashed static assets
// get long-lived caching; index.html is always revalidated so deploys land.
const buildPath = path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}static${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(buildPath, 'index.html'));
  });
} else {
  // No frontend build present (e.g. backend-only dev) - simple status page
  app.get('/', (req, res) => {
    res.json({
      message: 'Workout App API running with Postgres!',
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} on all interfaces`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Log initial memory usage
  logMemoryUsage();
});
