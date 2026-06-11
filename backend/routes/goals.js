const express = require('express');
const { pool } = require('../database.pg');
const authenticateToken = require('./authMiddleware');
const { estimateCurrentOneRm } = require('../lib/oneRm');
const router = express.Router();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDateString = (d) =>
  (typeof d === 'string') ? d.slice(0, 10) : d.toISOString().slice(0, 10);

// Expected 1RM today: linear interpolation between start and target,
// clamped to the goal window.
function expectedOneRm(goal, now = new Date()) {
  const start = new Date(toDateString(goal.start_date)).getTime();
  const end = new Date(toDateString(goal.target_date)).getTime();
  const t = Math.min(Math.max(now.getTime(), start), end);
  const span = end - start;
  const frac = span <= 0 ? 1 : (t - start) / span;
  return goal.start_one_rm + (goal.target_one_rm - goal.start_one_rm) * frac;
}

async function currentOneRmFor(userId, exerciseId) {
  const result = await pool.query(
    'SELECT w.date, ws.weight, ws.reps FROM workout_sets ws JOIN workouts w ON ws.workout_id = w.id WHERE ws.user_id = $1 AND ws.exercise_id = $2 ORDER BY w.date ASC, ws.set_number ASC',
    [userId, exerciseId]
  );
  return estimateCurrentOneRm(result.rows);
}

// GET all active goals with live progress
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      `SELECT g.*, e.name AS exercise_name, e.muscle_group
       FROM goals g JOIN exercises e ON g.exercise_id = e.id
       WHERE g.user_id = $1 AND g.status = 'active'
       ORDER BY g.target_date ASC`,
      [userId]
    );
    const goals = await Promise.all(result.rows.map(async (goal) => {
      const current = await currentOneRmFor(userId, goal.exercise_id);
      const expected = expectedOneRm(goal);
      const span = goal.target_one_rm - goal.start_one_rm;
      const progress = span === 0 ? 1 : (current - goal.start_one_rm) / span;
      // Small tolerance so a freshly created goal isn't instantly "behind"
      const tolerance = Math.max(0.5, Math.abs(span) * 0.05);
      return {
        ...goal,
        start_date: toDateString(goal.start_date),
        target_date: toDateString(goal.target_date),
        current_one_rm: Math.round(current * 10) / 10,
        expected_one_rm: Math.round(expected * 10) / 10,
        progress: Math.min(Math.max(progress, 0), 1),
        on_track: current >= expected - tolerance,
        achieved: current >= goal.target_one_rm,
      };
    }));
    res.json(goals);
  } catch (err) {
    console.error('Error fetching goals:', err);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// POST create a goal. start_one_rm is snapshotted from the current
// LOESS estimate so progress is measured from where the user is now.
router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { exercise_id, target_one_rm, target_date } = req.body;
  if (!exercise_id || !target_one_rm || !target_date) {
    return res.status(400).json({ error: 'exercise_id, target_one_rm and target_date are required' });
  }
  const target = parseFloat(target_one_rm);
  if (!Number.isFinite(target) || target <= 0) {
    return res.status(400).json({ error: 'target_one_rm must be a positive number' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target_date) || Number.isNaN(new Date(target_date).getTime())) {
    return res.status(400).json({ error: 'target_date must be YYYY-MM-DD' });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (target_date <= today) {
    return res.status(400).json({ error: 'target_date must be in the future' });
  }
  try {
    const existing = await pool.query(
      "SELECT id FROM goals WHERE user_id = $1 AND exercise_id = $2 AND status = 'active'",
      [userId, exercise_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An active goal already exists for this exercise' });
    }
    const current = await currentOneRmFor(userId, exercise_id);
    if (!current || current <= 0) {
      return res.status(400).json({ error: 'Log some sets for this exercise first so a starting 1RM can be estimated' });
    }
    if (target <= current) {
      return res.status(400).json({ error: `Target must be above your current estimated 1RM (${Math.round(current * 10) / 10} kg)` });
    }
    const result = await pool.query(
      `INSERT INTO goals (user_id, exercise_id, start_date, target_date, start_one_rm, target_one_rm)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, exercise_id, today, target_date, Math.round(current * 10) / 10, target]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating goal:', err);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// DELETE a goal
router.delete('/:id', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      'DELETE FROM goals WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    console.error('Error deleting goal:', err);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

module.exports = router;
