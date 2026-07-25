const express = require('express');
const { pool } = require('../database.pg');
const authenticateToken = require('./authMiddleware');
const router = express.Router();

// GET all workouts for a user (optional ?date=YYYY-MM-DD filter)
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { date } = req.query;
  try {
    let workoutsResult;
    if (date) {
      workoutsResult = await pool.query(
        'SELECT * FROM workouts WHERE user_id = $1 AND date = $2 ORDER BY date DESC',
        [userId, date]
      );
    } else {
      workoutsResult = await pool.query(
        'SELECT * FROM workouts WHERE user_id = $1 ORDER BY date DESC',
        [userId]
      );
    }
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

// GET a single workout by ID (with sets)
router.get('/:id', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  try {
    const workoutResult = await pool.query(
      'SELECT * FROM workouts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (workoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    const workout = workoutResult.rows[0];
    const setsResult = await pool.query(
      'SELECT ws.*, e.name as exercise_name, e.muscle_group FROM workout_sets ws JOIN exercises e ON ws.exercise_id = e.id WHERE ws.workout_id = $1',
      [id]
    );
    res.json({ ...workout, sets: setsResult.rows || [] });
  } catch (err) {
    console.error('Error fetching workout:', err);
    res.status(500).json({ error: 'Failed to fetch workout' });
  }
});

// POST create a new workout (and sets). If a workout already exists for the
// same date, sets are appended to it instead of creating a duplicate workout.
router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { date, notes, sets } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 1. Reuse the existing workout for this date, or create one
    const existingResult = await client.query(
      'SELECT * FROM workouts WHERE user_id = $1 AND date = $2 ORDER BY id LIMIT 1',
      [userId, date]
    );
    let workout = existingResult.rows[0];
    if (!workout) {
      const workoutResult = await client.query(
        'INSERT INTO workouts (user_id, date, notes) VALUES ($1, $2, $3) RETURNING *',
        [userId, date, notes]
      );
      workout = workoutResult.rows[0];
    }

    // 2. Insert sets if provided, continuing set numbering from existing sets
    let insertedSets = [];
    if (Array.isArray(sets) && sets.length > 0) {
      const maxResult = await client.query(
        'SELECT COALESCE(MAX(set_number), 0) AS max_set FROM workout_sets WHERE workout_id = $1',
        [workout.id]
      );
      const setNumberOffset = maxResult.rows[0].max_set;
      for (const [idx, set] of sets.entries()) {
        const setResult = await client.query(
          'INSERT INTO workout_sets (user_id, workout_id, exercise_id, weight, reps, duration_seconds, set_number) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
          [
            userId,
            workout.id,
            set.exercise_id,
            set.weight ?? null,
            set.reps ?? null,
            set.duration_seconds ?? null,
            setNumberOffset + (set.set_number || idx + 1),
          ]
        );
        insertedSets.push(setResult.rows[0]);
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ ...workout, sets: insertedSets });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating workout and sets:', err);
    res.status(500).json({ error: 'Failed to create workout and sets' });
  } finally {
    client.release();
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