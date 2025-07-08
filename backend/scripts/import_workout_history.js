const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const csv = require('csv-parser');

const DB_PATH = path.join(__dirname, '../workout.db');
const CSV_PATH = '/Users/williammaher/Downloads/workout_history.csv';

const db = new sqlite3.Database(DB_PATH);

async function run() {
  // Read CSV
  const rows = await new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });

  // Get unique exercises
  const exercises = Array.from(new Set(rows.map(r => r.Exercise.trim())));

  // Start transaction
  await exec('BEGIN TRANSACTION;');

  try {
    // 1. Update exercises table to match only those in CSV
    await exec('DELETE FROM exercises WHERE name NOT IN (' + exercises.map(() => '?').join(',') + ')', exercises);
    for (const ex of exercises) {
      await exec('INSERT OR IGNORE INTO exercises (name, muscle_group) VALUES (?, ?)', [ex, 'Unknown']);
    }

    // 2. For each exercise, delete all sets for that exercise
    for (const ex of exercises) {
      const exRow = await get('SELECT id FROM exercises WHERE name = ?', [ex]);
      if (!exRow) continue;
      await exec('DELETE FROM workout_sets WHERE exercise_id = ?', [exRow.id]);
    }

    // 3. Insert all sets from CSV, creating workouts as needed (grouped by date)
    // Map: { 'YYYY-MM-DD': workout_id }
    const workoutIdByDate = {};
    for (const row of rows) {
      const date = row.Date.trim();
      const weight = parseFloat(row.Weight);
      const reps = parseInt(row.Reps);
      const exercise = row.Exercise.trim();
      if (!date || isNaN(weight) || isNaN(reps) || !exercise) continue;
      // Get or create workout for this date
      let workout_id = workoutIdByDate[date];
      if (!workout_id) {
        const w = await get('SELECT id FROM workouts WHERE date = ?', [date]);
        if (w) {
          workout_id = w.id;
        } else {
          const result = await runInsert('INSERT INTO workouts (date) VALUES (?)', [date]);
          workout_id = result.lastID;
        }
        workoutIdByDate[date] = workout_id;
      }
      // Get exercise_id
      const exRow = await get('SELECT id FROM exercises WHERE name = ?', [exercise]);
      if (!exRow) continue;
      // Insert set
      await exec('INSERT INTO workout_sets (workout_id, exercise_id, weight, reps, set_number) VALUES (?, ?, ?, ?, ?)', [workout_id, exRow.id, weight, reps, 1]);
    }

    await exec('COMMIT;');
    console.log('Import complete.');
    console.log(`Imported ${rows.length} sets for ${exercises.length} exercises.`);
  } catch (err) {
    await exec('ROLLBACK;');
    console.error('Error during import:', err);
  } finally {
    db.close();
  }
}

function exec(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function get(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function(err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
function runInsert(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

run(); 