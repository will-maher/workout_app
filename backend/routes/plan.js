const express = require('express');
const { pool } = require('../database.pg');
const authenticateToken = require('./authMiddleware');
const router = express.Router();

// GET user's plan
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query('SELECT plan_json FROM plans WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No plan found for user' });
    }
    let plan = result.rows[0].plan_json;
    if (typeof plan === 'string') {
      try { plan = JSON.parse(plan); } catch {}
    }
    res.json(plan);
  } catch (err) {
    console.error('Error fetching plan:', err);
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

// POST or update user's plan
router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { plan_json } = req.body;
  if (!plan_json) {
    return res.status(400).json({ error: 'plan_json is required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO plans (user_id, plan_json, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET plan_json = $2, updated_at = NOW() RETURNING *',
      [userId, plan_json]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error saving plan:', err);
    res.status(500).json({ error: 'Failed to save plan' });
  }
});

module.exports = router; 