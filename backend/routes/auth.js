const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database.pg');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

// Register endpoint
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  
  // Ensure password is a string
  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'Password must be a string.' });
  }
  
  try {
    const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists.' });
    }
    
    console.log('Hashing password for user:', username);
    const password_hash = bcrypt.hashSync(password, 10);
    console.log('Password hash generated successfully, length:', password_hash.length);
    
    const insertResult = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
      [username, password_hash]
    );
    const userId = insertResult.rows[0].id;
    const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.message && err.message.includes('string did not match')) {
      console.error('Bcrypt error details:', err);
      return res.status(500).json({ error: 'Password hashing failed. Please try again.' });
    }
    res.status(500).json({ error: 'Failed to register user.' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  
  // Ensure password is a string
  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'Password must be a string.' });
  }
  
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = userResult.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid username or password.' });
    
    console.log('Comparing password for user:', username);
    console.log('Stored hash length:', user.password_hash ? user.password_hash.length : 'null');
    
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    
    const token = jwt.sign({ userId: user.id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    console.error('Login error:', err);
    if (err.message && err.message.includes('string did not match')) {
      console.error('Bcrypt error details:', err);
      return res.status(500).json({ error: 'Password verification failed. Please try again.' });
    }
    res.status(500).json({ error: 'Database error.' });
  }
});

module.exports = router; 