const express = require('express');
const { pool } = require('../database.pg');
const authenticateToken = require('./authMiddleware');
const { estimateCurrentOneRm } = require('../lib/oneRm');
const router = express.Router();

// One rep max uses the Brzycki formula: weight / (1.0278 - 0.0278 * reps),
// matching the frontend calculations.

// GET one rep max stats for exercises (user-specific)
router.get('/one-rep-max', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { exercise_id, limit = 10 } = req.query;
  
  let query = `
    SELECT 
      e.id as exercise_id,
      e.name as exercise_name,
      e.muscle_group,
      ws.weight,
      ws.reps,
      (ws.weight / (1.0278 - (0.0278 * ws.reps))) as one_rep_max,
      w.date
    FROM workout_sets ws
    JOIN exercises e ON ws.exercise_id = e.id
    JOIN workouts w ON ws.workout_id = w.id
    WHERE ws.user_id = $1
  `;
  const params = [userId];

  if (exercise_id) {
    query += ' AND e.id = $' + (params.length + 1);
    params.push(exercise_id);
  }

  query += ' ORDER BY one_rep_max DESC LIMIT $' + (params.length + 1);
  params.push(parseInt(limit));

  pool.query(query, params, (err, result) => {
    if (err) {
      console.error('Error fetching one rep max stats:', err);
      return res.status(500).json({ error: 'Failed to fetch one rep max stats' });
    }

    // Group by exercise and get the highest one rep max for each
    const exerciseMaxes = {};
    result.rows.forEach(row => {
      if (!exerciseMaxes[row.exercise_id] || row.one_rep_max > exerciseMaxes[row.exercise_id].one_rep_max) {
        exerciseMaxes[row.exercise_id] = row;
      }
    });

    const sortedMaxes = Object.values(exerciseMaxes).sort((a, b) => b.one_rep_max - a.one_rep_max);
    res.json(sortedMaxes);
  });
});

// GET weekly volume by muscle group (user-specific)
router.get('/weekly-volume', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { start_date, end_date } = req.query;
  
  let dateFilter = 'WHERE ws.user_id = $1';
  const params = [userId];
  
  if (start_date && end_date) {
    dateFilter += ' AND w.date BETWEEN $' + (params.length + 1) + ' AND $' + (params.length + 2);
    params.push(start_date, end_date);
  } else if (start_date) {
    dateFilter += ' AND w.date >= $' + (params.length + 1);
    params.push(start_date);
  }

  const query = `
    SELECT 
      e.muscle_group,
      SUM(ws.weight * ws.reps) as total_volume,
      COUNT(DISTINCT w.id) as workout_count,
      COUNT(ws.id) as total_sets,
      AVG(ws.weight) as avg_weight,
      AVG(ws.reps) as avg_reps
    FROM workout_sets ws
    JOIN exercises e ON ws.exercise_id = e.id
    JOIN workouts w ON ws.workout_id = w.id
    ${dateFilter}
    GROUP BY e.muscle_group
    ORDER BY total_volume DESC
  `;

  pool.query(query, params, (err, result) => {
    if (err) {
      console.error('Error fetching weekly volume stats:', err);
      return res.status(500).json({ error: 'Failed to fetch weekly volume stats' });
    }
    res.json(result.rows);
  });
});

// GET personal records (user-specific)
router.get('/personal-records', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { exercise_id } = req.query;
  
  let query = `
    SELECT 
      e.id as exercise_id,
      e.name as exercise_name,
      e.muscle_group,
      MAX(ws.weight) as max_weight,
      MAX(ws.reps) as max_reps,
      MAX(ws.weight * ws.reps) as max_volume,
      MAX(ws.weight / (1.0278 - (0.0278 * ws.reps))) as max_one_rep_max
    FROM workout_sets ws
    JOIN exercises e ON ws.exercise_id = e.id
    WHERE ws.user_id = $1
  `;

  const params = [userId];
  if (exercise_id) {
    query += ' AND e.id = $' + (params.length + 1);
    params.push(exercise_id);
  }

  query += ' GROUP BY e.id ORDER BY max_one_rep_max DESC';

  pool.query(query, params, (err, result) => {
    if (err) {
      console.error('Error fetching personal records:', err);
      return res.status(500).json({ error: 'Failed to fetch personal records' });
    }
    res.json(result.rows);
  });
});

// GET workout frequency over time (user-specific)
router.get('/workout-frequency', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { days = 30 } = req.query;
  
  const query = `
    SELECT
      date,
      COUNT(*) as workout_count
    FROM workouts
    WHERE user_id = $1 AND date >= CURRENT_DATE - make_interval(days => $2)
    GROUP BY date
    ORDER BY date DESC
  `;

  pool.query(query, [userId, parseInt(days, 10) || 30], (err, result) => {
    if (err) {
      console.error('Error fetching workout frequency:', err);
      return res.status(500).json({ error: 'Failed to fetch workout frequency' });
    }
    res.json(result.rows);
  });
});

// GET exercise progress over time (user-specific)
router.get('/exercise-progress', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { exercise_id, days = 90 } = req.query;
  
  if (!exercise_id) {
    return res.status(400).json({ error: 'exercise_id is required' });
  }

  const query = `
    SELECT 
      w.date,
      AVG(ws.weight) as avg_weight,
      AVG(ws.reps) as avg_reps,
      MAX(ws.weight) as max_weight,
      MAX(ws.weight / (1.0278 - (0.0278 * ws.reps))) as max_one_rep_max
    FROM workout_sets ws
    JOIN workouts w ON ws.workout_id = w.id
    WHERE ws.user_id = $1 AND ws.exercise_id = $2
      AND w.date >= CURRENT_DATE - make_interval(days => $3)
    GROUP BY w.date
    ORDER BY w.date DESC
  `;

  pool.query(query, [userId, exercise_id, parseInt(days, 10) || 90], (err, result) => {
    if (err) {
      console.error('Error fetching exercise progress:', err);
      return res.status(500).json({ error: 'Failed to fetch exercise progress' });
    }
    res.json(result.rows);
  });
});

// GET muscle group distribution (user-specific)
router.get('/muscle-group-distribution', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { days = 30 } = req.query;
  
  const query = `
    SELECT 
      e.muscle_group,
      COUNT(ws.id) as total_sets,
      SUM(ws.weight * ws.reps) as total_volume,
      COUNT(DISTINCT w.id) as workout_count
    FROM workout_sets ws
    JOIN exercises e ON ws.exercise_id = e.id
    JOIN workouts w ON ws.workout_id = w.id
    WHERE ws.user_id = $1 AND w.date >= CURRENT_DATE - make_interval(days => $2)
    GROUP BY e.muscle_group
    ORDER BY total_volume DESC
  `;

  pool.query(query, [userId, parseInt(days, 10) || 30], (err, result) => {
    if (err) {
      console.error('Error fetching muscle group distribution:', err);
      return res.status(500).json({ error: 'Failed to fetch muscle group distribution' });
    }
    res.json(result.rows);
  });
});

// GET recent workout summary (user-specific)
router.get('/recent-summary', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { limit = 5 } = req.query;
  
  const query = `
    SELECT 
      w.id,
      w.date,
      w.notes,
      COUNT(ws.id) as total_sets,
      SUM(ws.weight * ws.reps) as total_volume,
      COUNT(DISTINCT ws.exercise_id) as exercises_count
    FROM workouts w
    LEFT JOIN workout_sets ws ON w.id = ws.workout_id
    WHERE w.user_id = $1
    GROUP BY w.id
    ORDER BY w.date DESC
    LIMIT $2
  `;

  pool.query(query, [userId, parseInt(limit)], (err, result) => {
    if (err) {
      console.error('Error fetching recent summary:', err);
      return res.status(500).json({ error: 'Failed to fetch recent summary' });
    }
    res.json(result.rows);
  });
});

// GET all sets for a given exercise (for performance tab, user-specific)
router.get('/performance/sets', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { exercise_id } = req.query;
  if (!exercise_id) {
    return res.status(400).json({ error: 'exercise_id is required' });
  }
  let query = 'SELECT w.date, ws.weight, ws.reps, ws.set_number FROM workout_sets ws JOIN workouts w ON ws.workout_id = w.id WHERE ws.user_id = $1 AND ws.exercise_id = $2 ORDER BY w.date ASC, ws.set_number ASC';
  const params = [userId, exercise_id];
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sets for performance:', err);
    res.status(500).json({ error: 'Failed to fetch sets' });
  }
});

// GET weekly sets by muscle group and week (user-specific)
router.get('/weekly-sets-by-muscle-group', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  // Optional: accept ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
  const { start_date, end_date } = req.query;
  const params = [userId];
  let query = `
    SELECT 
      e.muscle_group,
      to_char(w.date, 'IYYY-"W"IW') as week,
      COUNT(ws.id) as total_sets
    FROM workout_sets ws
    JOIN exercises e ON ws.exercise_id = e.id
    JOIN workouts w ON ws.workout_id = w.id
  `;
  if (start_date && end_date) {
    query += ' WHERE ws.user_id = $1 AND w.date BETWEEN $2 AND $3';
    params.push(start_date, end_date);
  } else if (start_date) {
    query += ' WHERE ws.user_id = $1 AND w.date >= $2';
    params.push(start_date);
  } else {
    query += ' WHERE ws.user_id = $1';
  }
  query += ' GROUP BY e.muscle_group, week ORDER BY e.muscle_group, week';
  
  pool.query(query, params, (err, result) => {
    if (err) {
      console.error('Error fetching weekly sets by muscle group:', err);
      return res.status(500).json({ error: 'Failed to fetch weekly sets by muscle group' });
    }
    res.json(result.rows);
  });
});

// GET recent sets for a specific exercise (user-specific)
router.get('/recent-sets', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { exercise_id, limit = 10 } = req.query;
  if (!exercise_id) {
    return res.status(400).json({ error: 'exercise_id is required' });
  }
  const query = `
    SELECT 
      TO_CHAR(w.date, 'DD Mon YY') as date_formatted,
      ws.weight,
      ws.reps,
      ws.set_number,
      (ws.weight / (1.0278 - (0.0278 * ws.reps))) as one_rep_max
    FROM workout_sets ws
    JOIN workouts w ON ws.workout_id = w.id
    WHERE ws.user_id = $1 AND ws.exercise_id = $2
    ORDER BY w.date DESC, ws.set_number ASC
    LIMIT $3
  `;
  try {
    const result = await pool.query(query, [userId, exercise_id, parseInt(limit)]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent sets:', err);
    res.status(500).json({ error: 'Failed to fetch recent sets' });
  }
});

// GET estimated one rep max and suggested weights for an exercise (user-specific)
router.get('/suggested-weights', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { exercise_id } = req.query;
  if (!exercise_id) {
    return res.status(400).json({ error: 'exercise_id is required' });
  }
  try {
    // Fetch all sets for this exercise, ordered by workout date
    const result = await pool.query(
      'SELECT w.date, ws.weight, ws.reps FROM workout_sets ws JOIN workouts w ON ws.workout_id = w.id WHERE ws.user_id = $1 AND ws.exercise_id = $2 ORDER BY w.date ASC, ws.set_number ASC',
      [userId, exercise_id]
    );
    if (!result.rows || result.rows.length === 0) {
      return res.json({
        estimated_one_rep_max: 0,
        suggested_weights: {
          reps_3: 0,
          reps_5: 0,
          reps_8: 0,
          reps_12: 0
        }
      });
    }
    const estimatedOneRepMax = estimateCurrentOneRm(result.rows);
    const newOneRepMax = estimatedOneRepMax + 1;
    // Reverse Brzycki (weight = 1RM * (1.0278 - 0.0278 * reps)) to match the
    // forward 1RM formula used everywhere else in the app.
    const suggestedWeights = {
      reps_3: Math.round((newOneRepMax * (1.0278 - (0.0278 * 3))) * 10) / 10,
      reps_5: Math.round((newOneRepMax * (1.0278 - (0.0278 * 5))) * 10) / 10,
      reps_8: Math.round((newOneRepMax * (1.0278 - (0.0278 * 8))) * 10) / 10,
      reps_12: Math.round((newOneRepMax * (1.0278 - (0.0278 * 12))) * 10) / 10
    };
    res.json({
      estimated_one_rep_max: Math.round(estimatedOneRepMax * 10) / 10,
      new_one_rep_max: Math.round(newOneRepMax * 10) / 10,
      suggested_weights: suggestedWeights
    });
  } catch (err) {
    console.error('Error fetching suggested weights:', err);
    res.status(500).json({ error: 'Failed to fetch suggested weights' });
  }
});

module.exports = router; 