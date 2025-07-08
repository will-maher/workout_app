const express = require('express');
const { pool } = require('../database.pg');
const router = express.Router();

// GET all exercises
router.get('/', async (req, res) => {
  const { muscle_group, category } = req.query;
  let query = 'SELECT * FROM exercises';
  const params = [];

  if (muscle_group || category) {
    query += ' WHERE';
    if (muscle_group) {
      query += ' muscle_group = $1';
      params.push(muscle_group);
    }
    if (category) {
      if (muscle_group) query += ' AND';
      query += ` category = $${params.length + 1}`;
      params.push(category);
    }
  }

  query += ' ORDER BY name';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching exercises:', err);
    res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});

// GET exercise by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('SELECT * FROM exercises WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exercise not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching exercise:', err);
    res.status(500).json({ error: 'Failed to fetch exercise' });
  }
});

// POST new exercise
router.post('/', async (req, res) => {
  const { name, muscle_group, category = 'strength' } = req.body;

  if (!name || !muscle_group) {
    return res.status(400).json({ error: 'Name and muscle_group are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO exercises (name, muscle_group, category) VALUES ($1, $2, $3) RETURNING id',
      [name, muscle_group, category]
    );
    res.status(201).json({
      id: result.rows[0].id,
      name,
      muscle_group,
      category,
      message: 'Exercise created successfully'
    });
  } catch (err) {
    console.error('Error creating exercise:', err);
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'Exercise with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create exercise' });
  }
});

// PUT update exercise
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, muscle_group, category } = req.body;

  if (!name || !muscle_group) {
    return res.status(400).json({ error: 'Name and muscle_group are required' });
  }

  try {
    const result = await pool.query(
      'UPDATE exercises SET name = $1, muscle_group = $2, category = $3 WHERE id = $4',
      [name, muscle_group, category, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Exercise not found' });
    }
    res.json({ message: 'Exercise updated successfully' });
  } catch (err) {
    console.error('Error updating exercise:', err);
    res.status(500).json({ error: 'Failed to update exercise' });
  }
});

// DELETE exercise
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM exercises WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Exercise not found' });
    }
    res.json({ message: 'Exercise deleted successfully' });
  } catch (err) {
    console.error('Error deleting exercise:', err);
    res.status(500).json({ error: 'Failed to delete exercise' });
  }
});

// GET muscle groups
router.get('/muscle-groups/list', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT muscle_group FROM exercises ORDER BY muscle_group');
    const muscleGroups = result.rows.map(row => row.muscle_group);
    res.json(muscleGroups);
  } catch (err) {
    console.error('Error fetching muscle groups:', err);
    res.status(500).json({ error: 'Failed to fetch muscle groups' });
  }
});

module.exports = router; 