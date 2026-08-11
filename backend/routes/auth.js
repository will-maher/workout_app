const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database.pg');

const router = express.Router();

// Use environment variable for JWT secret, with a fallback for development only
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev_secret_key');

// A personal tracker is opened a few times a week; a 7 day window logged people
// out constantly. There is no refresh flow, so the token lifetime is the
// session length.
const TOKEN_TTL = '30d';

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}

// Register endpoint
router.post('/register', async (req, res) => {
  const password = req.body.password;
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : req.body.username;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  
  // Ensure password is a string
  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'Password must be a string.' });
  }
  
  // Validate password strength
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }
  
  try {
    // Compare case-insensitively so 'Will' and 'will' can't become two accounts.
    const userResult = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (userResult.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists.' });
    }
    
    const password_hash = bcrypt.hashSync(password, 10);
    
    const insertResult = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
      [username, password_hash]
    );
    const userId = insertResult.rows[0].id;
    const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    res.json({ token, username });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register user.' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  const password = req.body.password;
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : req.body.username;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  
  // Ensure password is a string
  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'Password must be a string.' });
  }
  
  try {
    // Case-insensitive so capitalisation (or a phone auto-capitalising the
    // first letter) doesn't cause a spurious "invalid credentials".
    const userResult = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    const user = userResult.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid username or password.' });
    
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

module.exports = router; 