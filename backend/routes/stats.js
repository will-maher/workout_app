const express = require('express');
const { pool } = require('../database.pg');
const authenticateToken = require('./authMiddleware');
const router = express.Router();

// Calculate one rep max using Epley formula
const calculateOneRepMax = (weight, reps) => {
  return weight * (1 + reps / 30);
};

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
      (ws.weight * (1 + ws.reps / 30)) as one_rep_max,
      w.date
    FROM workout_sets ws
    JOIN exercises e ON ws.exercise_id = e.id
    JOIN workouts w ON ws.workout_id = w.id
    WHERE ws.user_id = ?
  `;
  const params = [userId];

  if (exercise_id) {
    query += ' AND e.id = ?';
    params.push(exercise_id);
  }

  query += ' ORDER BY one_rep_max DESC LIMIT ?';
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
  
  let dateFilter = 'WHERE ws.user_id = ?';
  const params = [userId];
  
  if (start_date && end_date) {
    dateFilter += ' AND w.date BETWEEN ? AND ?';
    params.push(start_date, end_date);
  } else if (start_date) {
    dateFilter += ' AND w.date >= ?';
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
      MAX(ws.weight * (1 + ws.reps / 30)) as max_one_rep_max
    FROM workout_sets ws
    JOIN exercises e ON ws.exercise_id = e.id
    WHERE ws.user_id = ?
  `;

  const params = [userId];
  if (exercise_id) {
    query += ' AND e.id = ?';
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
    WHERE user_id = ? AND date >= date('now', '-${days} days')
    GROUP BY date
    ORDER BY date DESC
  `;

  pool.query(query, [userId], (err, result) => {
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
      MAX(ws.weight * (1 + ws.reps / 30)) as max_one_rep_max
    FROM workout_sets ws
    JOIN workouts w ON ws.workout_id = w.id
    WHERE ws.user_id = ? AND ws.exercise_id = ? 
      AND w.date >= date('now', '-${days} days')
    GROUP BY w.date
    ORDER BY w.date DESC
  `;

  pool.query(query, [userId, exercise_id], (err, result) => {
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
    WHERE ws.user_id = ? AND w.date >= date('now', '-${days} days')
    GROUP BY e.muscle_group
    ORDER BY total_volume DESC
  `;

  pool.query(query, [userId], (err, result) => {
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
    WHERE w.user_id = ?
    GROUP BY w.id
    ORDER BY w.date DESC
    LIMIT ?
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
  let dateFilter = 'WHERE ws.user_id = ?';
  const params = [userId];
  if (start_date && end_date) {
    dateFilter += ' AND w.date BETWEEN ? AND ?';
    params.push(start_date, end_date);
  } else if (start_date) {
    dateFilter += ' AND w.date >= ?';
    params.push(start_date);
  }
  dateFilter += ' '; // Always add a space at the end
  // Use Postgres to_char for ISO week
  const query = `
    SELECT 
      e.muscle_group,
      to_char(w.date, 'IYYY-"W"IW') as week,
      COUNT(ws.id) as total_sets
    FROM workout_sets ws
    JOIN exercises e ON ws.exercise_id = e.id
    JOIN workouts w ON ws.workout_id = w.id
  ` + dateFilter + `
    GROUP BY e.muscle_group, week
    ORDER BY e.muscle_group, week
  `;
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
    // Calculate 1RM for each set
    const points = result.rows.map(set => ({
      date: (typeof set.date === 'string') ? set.date : set.date.toISOString().slice(0, 10),
      one_rm: set.weight / (1.0278 - 0.0278 * set.reps)
    }));
    // Get daily max 1RM (one per date)
    const byDate = {};
    points.forEach(pt => {
      const dateOnly = pt.date.slice(0, 10);
      if (!byDate[dateOnly] || pt.one_rm > byDate[dateOnly].one_rm) {
        byDate[dateOnly] = { ...pt, date: dateOnly };
      }
    });
    const dailyMax = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    // LOESS smoothing (same as performance tab)
    function loess(xs, ys, bandwidth = 0.08) {
      const n = xs.length;
      const bw = Math.max(2, Math.floor(bandwidth * n));
      const result = [];
      for (let i = 0; i < n; i++) {
        const distances = xs.map(x => Math.abs(x - xs[i]));
        const idxs = distances
          .map((d, idx) => [d, idx])
          .sort((a, b) => a[0] - b[0])
          .slice(0, bw)
          .map(pair => pair[1]);
        const xw = idxs.map(j => xs[j]);
        const yw = idxs.map(j => ys[j]);
        const xbar = xw.reduce((a, b) => a + b, 0) / bw;
        const ybar = yw.reduce((a, b) => a + b, 0) / bw;
        const num = xw.reduce((sum, xj, k) => sum + (xj - xbar) * (yw[k] - ybar), 0);
        const den = xw.reduce((sum, xj) => sum + (xj - xbar) ** 2, 0);
        const beta = den === 0 ? 0 : num / den;
        const alpha = ybar - beta * xbar;
        result.push([xs[i], alpha + beta * xs[i]]);
      }
      return result;
    }
    let estimatedOneRepMax = 0;
    if (dailyMax.length >= 3) {
      // Use LOESS smoothed value for the latest date
      const xs = dailyMax.map(pt => new Date(pt.date).getTime());
      const ys = dailyMax.map(pt => pt.one_rm);
      const loessLine = loess(xs, ys, 0.08);
      estimatedOneRepMax = loessLine[loessLine.length - 1][1];
    } else {
      // Fallback: use latest daily max 1RM
      estimatedOneRepMax = dailyMax[dailyMax.length - 1].one_rm;
    }
    const newOneRepMax = estimatedOneRepMax + 1;
    const suggestedWeights = {
      reps_3: Math.round((newOneRepMax * (1.02 - (0.02 * 3))) * 10) / 10,
      reps_5: Math.round((newOneRepMax * (1.02 - (0.02 * 5))) * 10) / 10,
      reps_8: Math.round((newOneRepMax * (1.02 - (0.02 * 8))) * 10) / 10,
      reps_12: Math.round((newOneRepMax * (1.02 - (0.02 * 12))) * 10) / 10
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