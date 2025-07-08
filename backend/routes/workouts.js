const express = require('express');
const { pool } = require('../database.pg');
const authenticateToken = require('./authMiddleware');
const router = express.Router();

// GET all workouts for a user
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    // Fetch all workouts
    const workoutsResult = await pool.query(
      'SELECT * FROM workouts WHERE user_id = $1 ORDER BY date DESC',
      [userId]
    );
    const workouts = workoutsResult.rows;
    if (workouts.length === 0) return res.json([]);
    // Fetch all sets for these workouts
    const workoutIds = workouts.map(w => w.id);
    const setsResult = await pool.query(
      'SELECT ws.*, e.name as exercise_name, e.muscle_group FROM workout_sets ws JOIN exercises e ON ws.exercise_id = e.id WHERE ws.workout_id = ANY($1::int[])',
      [workoutIds]
    );
    const setsByWorkout = {};
    setsResult.rows.forEach(set => {
      if (!setsByWorkout[set.workout_id]) setsByWorkout[set.workout_id] = [];
      setsByWorkout[set.workout_id].push(set);
    });
    // Attach sets to each workout
    const workoutsWithSets = workouts.map(w => ({ ...w, sets: setsByWorkout[w.id] || [] }));
    res.json(workoutsWithSets);
  } catch (err) {
    console.error('Error fetching workouts:', err);
    res.status(500).json({ error: 'Failed to fetch workouts' });
  }
});

// GET a single workout by ID
router.get('/:id', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM workouts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching workout:', err);
    res.status(500).json({ error: 'Failed to fetch workout' });
  }
});

// POST create a new workout
router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { date, notes } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO workouts (user_id, date, notes) VALUES ($1, $2, $3) RETURNING *',
      [userId, date, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating workout:', err);
    res.status(500).json({ error: 'Failed to create workout' });
  }
});

// PUT update a workout
router.put('/:id', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  const { date, notes } = req.body;
  try {
    const result = await pool.query(
      'UPDATE workouts SET date = $1, notes = $2 WHERE id = $3 AND user_id = $4',
      [date, notes, id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    res.json({ message: 'Workout updated successfully' });
  } catch (err) {
    console.error('Error updating workout:', err);
    res.status(500).json({ error: 'Failed to update workout' });
  }
});

// DELETE a workout
router.delete('/:id', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM workouts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    res.json({ message: 'Workout deleted successfully' });
  } catch (err) {
    console.error('Error deleting workout:', err);
    res.status(500).json({ error: 'Failed to delete workout' });
  }
});

// POST add set to workout (user-specific)
router.post('/:id/sets', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  const { exercise_id, weight, reps, set_number } = req.body;

  if (!exercise_id || !weight || !reps || !set_number) {
    return res.status(400).json({ error: 'exercise_id, weight, reps, and set_number are required' });
  }

  try {
    // Check if workout exists
    const workoutResult = await pool.query('SELECT id FROM workouts WHERE id = $1 AND user_id = $2', [id, userId]);
    if (workoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    // Insert the set
    const setResult = await pool.query(
      'INSERT INTO workout_sets (user_id, workout_id, exercise_id, weight, reps, set_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, id, exercise_id, weight, reps, set_number]
    );
    res.status(201).json({
      ...setResult.rows[0],
      message: 'Set added successfully'
    });
  } catch (err) {
    console.error('Error adding set:', err);
    res.status(500).json({ error: 'Failed to add set' });
  }
});

// DELETE set from workout (user-specific)
router.delete('/sets/:setId', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { setId } = req.params;
  try {
    const result = await pool.query('DELETE FROM workout_sets WHERE id = $1 AND user_id = $2', [setId, userId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Set not found' });
    }
    res.json({ message: 'Set deleted successfully' });
  } catch (err) {
    console.error('Error deleting set:', err);
    res.status(500).json({ error: 'Failed to delete set' });
  }
});

module.exports = router; 