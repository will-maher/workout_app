/**
 * Seed sample workout data for testing the 1RM range bars.
 * Run from backend: node scripts/seed-sample-workouts.js
 * Uses DATABASE_URL from .env (or parent .env)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../database.pg');
const { format, subMonths } = require('date-fns');

async function seed() {
  const client = await pool.connect();
  try {
    // Find user 'will'
    const userRes = await client.query('SELECT id FROM users WHERE username = $1', ['will']);
    let userId = userRes.rows[0]?.id;
    if (!userId) {
      console.log('User "will" not found. Using first user in database...');
      const anyUser = await client.query('SELECT id, username FROM users LIMIT 1');
      if (anyUser.rows.length === 0) {
        console.error('No users found. Please create a user first (register in the app).');
        process.exit(1);
      }
      userId = anyUser.rows[0].id;
      console.log('Using user:', anyUser.rows[0].username);
    }

    // Get exercises to use (prefer ones that create good 1RM variety)
    const exercisesRes = await client.query(`
      SELECT id, name FROM exercises 
      WHERE name IN ('Dips', 'Barbell bench press', 'Deadlift', 'Pull ups', 'Incline barbell bench press', 'Cable lat pulldown')
      ORDER BY name
      LIMIT 6
    `);
    const exercises = exercisesRes.rows;
    if (exercises.length === 0) {
      const fallback = await client.query('SELECT id, name FROM exercises LIMIT 4');
      exercises.push(...fallback.rows);
    }
    if (exercises.length === 0) {
      console.error('No exercises found. Run init-db or add exercises via the app first.');
      process.exit(1);
    }
    console.log('Using exercises:', exercises.map(e => e.name).join(', '));

    // Sample data: each entry is [monthsAgo, exerciseIndex, weight, reps] for variety in 1RM
    const samples = [
      [0, 0, 55, 5],   [0, 0, 50, 8],   [0, 0, 45, 10],
      [1, 0, 50, 6],   [1, 0, 48, 7],
      [2, 0, 45, 8],   [2, 0, 42, 10],
      [3, 0, 52, 5],   [3, 0, 48, 7],
      [4, 0, 40, 10],  [4, 0, 38, 12],
      [5, 0, 50, 6],   [5, 0, 48, 8],
      [0, 1, 100, 5],  [0, 1, 90, 8],  [0, 1, 80, 10],
      [1, 1, 95, 6],   [2, 1, 85, 8],   [3, 1, 100, 4],
      [4, 1, 80, 10],  [5, 1, 90, 7],
      [0, 2, 190, 3],  [0, 2, 170, 5],  [1, 2, 180, 4],
      [2, 2, 160, 6],  [3, 2, 200, 2],  [4, 2, 150, 8],
      [0, 3, 35, 6],   [1, 3, 30, 8],   [2, 3, 25, 10],
      [0, 4, 80, 6],   [1, 4, 70, 8],   [2, 4, 75, 7],
      [0, 5, 85, 8],   [1, 5, 80, 10],  [2, 5, 90, 6],
    ].filter(([mo, exIdx]) => exIdx < exercises.length);

    let inserted = 0;
    const byDate = {};
    for (const [monthsAgo, exIdx, weight, reps] of samples) {
      const d = format(subMonths(new Date(), monthsAgo), 'yyyy-MM-dd');
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({ exerciseId: exercises[exIdx].id, weight, reps });
    }

    for (const [date, sets] of Object.entries(byDate)) {
      const wRes = await client.query(
        'INSERT INTO workouts (user_id, date) VALUES ($1, $2) RETURNING id',
        [userId, date]
      );
      const workoutId = wRes.rows[0].id;
      for (let i = 0; i < sets.length; i++) {
        const s = sets[i];
        await client.query(
          'INSERT INTO workout_sets (user_id, workout_id, exercise_id, weight, reps, set_number) VALUES ($1, $2, $3, $4, $5, $6)',
          [userId, workoutId, s.exerciseId, s.weight, s.reps, i + 1]
        );
        inserted++;
      }
    }

    console.log(`Inserted ${inserted} sets across ${Object.keys(byDate).length} workouts.`);
    console.log('Refresh the Add tab and add some sets to see the 1RM range bars.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
