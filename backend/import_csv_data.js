const { Pool } = require('pg');
const fs = require('fs');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');

// Use the new Railway Postgres URL
const pool = new Pool({
  connectionString: 'postgresql://postgres:sAAucHrsUpBWiUzVGipPzLodrgyOXJcM@yamabiko.proxy.rlwy.net:28629/railway',
  ssl: { rejectUnauthorized: false }
});

async function importCSVData() {
  try {
    console.log('🚀 Starting CSV data import to new Railway database...');
    
    // 1. Create user 'will' with password 'password'
    console.log('👤 Creating user will...');
    const passwordHash = bcrypt.hashSync('password', 10);
    
    const userResult = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET password_hash = $2 RETURNING id',
      ['will', passwordHash]
    );
    const userId = userResult.rows[0].id;
    console.log(`✅ User 'will' created/updated with ID: ${userId}`);

    // 2. Clear and import exercises from CSV
    console.log('🗑️ Clearing existing exercises...');
    await pool.query('DELETE FROM workout_sets');
    await pool.query('DELETE FROM workouts');
    await pool.query('DELETE FROM exercises');
    
    console.log('📝 Importing exercises from CSV...');
    const exercises = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream('../exercises.csv')
        .pipe(csv())
        .on('data', (row) => exercises.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    for (const exercise of exercises) {
      await pool.query(
        'INSERT INTO exercises (id, name, muscle_group, category, created_at) VALUES ($1, $2, $3, $4, $5)',
        [exercise.id, exercise.name, exercise.muscle_group, exercise.category || 'strength', exercise.created_at]
      );
    }
    console.log(`✅ Imported ${exercises.length} exercises`);

    // 3. Import workouts
    console.log('💪 Importing workouts...');
    const workouts = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream('../workouts.csv')
        .pipe(csv())
        .on('data', (row) => workouts.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    for (const workout of workouts) {
      await pool.query(
        'INSERT INTO workouts (id, user_id, date, notes, created_at) VALUES ($1, $2, $3, $4, $5)',
        [workout.id, userId, workout.date, workout.notes, workout.created_at]
      );
    }
    console.log(`✅ Imported ${workouts.length} workouts`);

    // 4. Import workout sets
    console.log('🏋️ Importing workout sets...');
    const workoutSets = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream('../workout_sets.csv')
        .pipe(csv())
        .on('data', (row) => workoutSets.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    for (const set of workoutSets) {
      await pool.query(
        'INSERT INTO workout_sets (id, user_id, workout_id, exercise_id, weight, reps, set_number, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [set.id, userId, set.workout_id, set.exercise_id, set.weight, set.reps, set.set_number, set.created_at]
      );
    }
    console.log(`✅ Imported ${workoutSets.length} workout sets`);

    // 5. Import plans (if exists)
    if (fs.existsSync('../plans.csv')) {
      console.log('📋 Importing workout plans...');
      const plans = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream('../plans.csv')
          .pipe(csv())
          .on('data', (row) => plans.push(row))
          .on('end', resolve)
          .on('error', reject);
      });

      for (const plan of plans) {
        await pool.query(
          'INSERT INTO plans (user_id, plan_json, updated_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET plan_json = $2, updated_at = $3',
          [userId, plan.plan_json, plan.updated_at]
        );
      }
      console.log(`✅ Imported ${plans.length} workout plans`);
    }

    // 6. Verify the import
    console.log('\n📊 Import verification:');
    const tables = ['users', 'exercises', 'workouts', 'workout_sets', 'plans'];
    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   ${table}: ${result.rows[0].count} rows`);
    }

    // 7. Verify user 'will' data
    const userWorkouts = await pool.query('SELECT COUNT(*) as count FROM workouts WHERE user_id = $1', [userId]);
    const userSets = await pool.query('SELECT COUNT(*) as count FROM workout_sets WHERE user_id = $1', [userId]);
    const userPlans = await pool.query('SELECT COUNT(*) as count FROM plans WHERE user_id = $1', [userId]);

    console.log(`\n👤 User 'will' data:`);
    console.log(`   Workouts: ${userWorkouts.rows[0].count}`);
    console.log(`   Sets: ${userSets.rows[0].count}`);
    console.log(`   Plans: ${userPlans.rows[0].count}`);

    console.log('\n🎉 CSV data import completed successfully!');
    console.log('🔗 User credentials: username: will, password: password');
    
  } catch (error) {
    console.error('❌ Error importing CSV data:', error);
  } finally {
    await pool.end();
  }
}

importCSVData(); 