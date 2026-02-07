const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Exercise names from the workout planner that need to be fixed
const exerciseMismatches = {
  'Pull-ups': 'Pull ups',
  'Stiff-legged DL': 'Stiff legged deadlift',
  'Overhead tricep extension': 'Overhead tricep extension rope',
  'Incline dumbell curl': 'Incline dumbell curl', // This one is actually correct
  'EZ bar curl': 'Ez bar curl',
  'Dumbbell shoulder press': 'Dumbell shoulder press',
  'Dumbbell lateral raise': 'Dumbell lateral raise',
  'Incline barbell bench press': 'Incline barbell bench press', // This one is correct
  'Barbell bench press': 'Barbell bench press', // This one is correct
  'Dips': 'Dips', // This one is correct
  'Cable flies': 'Cable flies', // This one is correct
  'Low bar squat': 'Low bar squat', // This one is correct
  'Hack squat': 'Hack squat', // This one is correct
  'Leg press calf raise': 'Leg press calf raise', // This one is correct
  'Lunges': 'Lunges', // This one is correct
  'Leg extension': 'Leg extension', // This one is correct
  'Barbell row': 'Barbell row', // This one is correct
  'Seated cable row': 'Seated cable row', // This one is correct
  'Hex bar shrugs': 'Hex bar shrugs', // This one is correct
  'Preacher curl': 'Machine preacher',
  'Hanging leg raise': 'Hanging leg raise', // This one is correct
  'High bar squat': 'High bar squat', // This one is correct
  'Leg press': 'Leg press', // This one is correct
  'Rear delt cable fly': 'Rear delt cable fly', // This one is correct
  'Deadlift': 'Deadlift', // This one is correct
  'Cable lat pulldown': 'Cable lat pulldown', // This one is correct
  'Ab cable crunch': 'Ab cable crunch' // This one is correct
};

async function checkExerciseMismatches() {
  try {
    console.log('🔍 Checking exercise name mismatches...\n');

    // Get all exercises from database
    const dbResult = await pool.query('SELECT name, muscle_group FROM exercises ORDER BY name');
    const dbExercises = dbResult.rows.map(row => row.name);
    
    console.log('📊 EXERCISE MISMATCHES:');
    console.log('=======================');
    
    let hasMismatches = false;
    
    // Check each exercise in the workout planner
    for (const [plannerName, dbName] of Object.entries(exerciseMismatches)) {
      if (plannerName !== dbName) {
        console.log(`❌ MISMATCH: "${plannerName}" → should be "${dbName}"`);
        hasMismatches = true;
      }
    }
    
    // Check for exercises in planner that don't exist in database
    const plannerExercises = Object.keys(exerciseMismatches);
    for (const plannerExercise of plannerExercises) {
      if (!dbExercises.includes(exerciseMismatches[plannerExercise])) {
        console.log(`❌ MISSING: "${plannerExercise}" → "${exerciseMismatches[plannerExercise]}" not found in database`);
        hasMismatches = true;
      }
    }
    
    if (!hasMismatches) {
      console.log('✅ All exercise names match the database!');
    }
    
    console.log('\n📋 EXERCISES IN WORKOUT PLANNER:');
    console.log('================================');
    plannerExercises.forEach(exercise => {
      const dbName = exerciseMismatches[exercise];
      const exists = dbExercises.includes(dbName);
      const status = exists ? '✅' : '❌';
      console.log(`${status} "${exercise}" → "${dbName}" ${exists ? '(exists)' : '(MISSING)'}`);
    });

  } catch (error) {
    console.error('❌ Error checking exercise mismatches:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkExerciseMismatches();
