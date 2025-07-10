const { Pool } = require('pg');

// Use the new Railway Postgres URL
const pool = new Pool({
  connectionString: 'postgresql://postgres:sAAucHrsUpBWiUzVGipPzLodrgyOXJcM@yamabiko.proxy.rlwy.net:28629/railway',
  ssl: { rejectUnauthorized: false }
});

async function fixSequences() {
  try {
    console.log('🔧 Fixing database sequences...');
    
    // Get the maximum IDs from each table
    const maxWorkoutId = await pool.query('SELECT MAX(id) as max_id FROM workouts');
    const maxSetId = await pool.query('SELECT MAX(id) as max_id FROM workout_sets');
    const maxExerciseId = await pool.query('SELECT MAX(id) as max_id FROM exercises');
    
    const workoutMaxId = maxWorkoutId.rows[0].max_id || 0;
    const setMaxId = maxSetId.rows[0].max_id || 0;
    const exerciseMaxId = maxExerciseId.rows[0].max_id || 0;
    
    console.log(`📊 Current max IDs:`);
    console.log(`   Workouts: ${workoutMaxId}`);
    console.log(`   Workout Sets: ${setMaxId}`);
    console.log(`   Exercises: ${exerciseMaxId}`);
    
    // Reset sequences to start from the next available ID
    await pool.query(`ALTER SEQUENCE workouts_id_seq RESTART WITH ${workoutMaxId + 1}`);
    await pool.query(`ALTER SEQUENCE workout_sets_id_seq RESTART WITH ${setMaxId + 1}`);
    await pool.query(`ALTER SEQUENCE exercises_id_seq RESTART WITH ${exerciseMaxId + 1}`);
    
    console.log('✅ Sequences reset successfully!');
    console.log(`   Workouts sequence now starts at: ${workoutMaxId + 1}`);
    console.log(`   Workout Sets sequence now starts at: ${setMaxId + 1}`);
    console.log(`   Exercises sequence now starts at: ${exerciseMaxId + 1}`);
    
  } catch (error) {
    console.error('❌ Error fixing sequences:', error);
  } finally {
    await pool.end();
  }
}

fixSequences(); 