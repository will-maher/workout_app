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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 