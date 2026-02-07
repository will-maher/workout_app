const express = require('express');
const { pool } = require('../database.pg');
const authenticateToken = require('./authMiddleware');
const router = express.Router();

// GET user's plan
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    console.log('🔍 Fetching plan for user:', userId);
    const result = await pool.query('SELECT plan_json FROM plans WHERE user_id = $1', [userId]);
    console.log('📊 Database result:', result.rows.length, 'rows');
    
    if (result.rows.length === 0) {
      console.log('ℹ️ No plan found for user, returning 404');
      return res.status(404).json({ error: 'No plan found for user' });
    }
    
    let plan = result.rows[0].plan_json;
    console.log('📋 Plan type:', typeof plan);
    
    if (typeof plan === 'string') {
      try { 
        plan = JSON.parse(plan); 
        console.log('✅ Successfully parsed plan from string');
      } catch (parseError) {
        console.error('❌ Error parsing plan string:', parseError);
        return res.status(500).json({ error: 'Invalid plan data' });
      }
    }
    
    // Validate plan structure
    if (!plan || typeof plan !== 'object') {
      console.log('❌ Invalid plan structure');
      return res.status(500).json({ error: 'Invalid plan structure' });
    }
    
    console.log('📤 Sending plan to frontend');
    res.json(plan);
  } catch (err) {
    console.error('❌ Error fetching plan:', err);
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

// POST or update user's plan
router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { plan_json } = req.body;
  
  console.log('💾 Saving plan for user:', userId);
  console.log('📋 Plan data type:', typeof plan_json);
  
  if (!plan_json) {
    console.log('❌ No plan_json provided');
    return res.status(400).json({ error: 'plan_json is required' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO plans (user_id, plan_json, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET plan_json = $2, updated_at = NOW() RETURNING *',
      [userId, plan_json]
    );
    console.log('✅ Plan saved successfully');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error saving plan:', err);
    res.status(500).json({ error: 'Failed to save plan' });
  }
});

module.exports = router; 