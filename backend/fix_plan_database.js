const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Exercise name mappings to fix
const exerciseMappings = {
  'Pull-ups': 'Pull ups',
  'Stiff-legged DL': 'Stiff legged deadlift',
  'Overhead tricep extension': 'Overhead tricep extension rope',
  'EZ bar curl': 'Ez bar curl',
  'Dumbbell shoulder press': 'Dumbell shoulder press',
  'Dumbbell lateral raise': 'Dumbell lateral raise',
  'Preacher curl': 'Machine preacher'
};

async function fixPlanDatabase() {
  try {
    console.log('🔧 Fixing plan database and exercise names...\n');

    // Get existing plans
    const result = await pool.query('SELECT user_id, plan_json FROM plans');
    
    for (const row of result.rows) {
      console.log(`Processing user ${row.user_id}...`);
      
      let plan;
      try {
        // Parse the plan if it's a string
        if (typeof row.plan_json === 'string') {
          plan = JSON.parse(row.plan_json);
        } else {
          plan = row.plan_json;
        }
      } catch (error) {
        console.log(`❌ Error parsing plan for user ${row.user_id}:`, error.message);
        continue;
      }

      let hasChanges = false;
      
      // Update exercise names in the plan
      for (const day of Object.keys(plan)) {
        if (Array.isArray(plan[day])) {
          for (const exercise of plan[day]) {
            if (exercise.exercise && exerciseMappings[exercise.exercise]) {
              console.log(`  Updating "${exercise.exercise}" → "${exerciseMappings[exercise.exercise]}"`);
              exercise.exercise = exerciseMappings[exercise.exercise];
              hasChanges = true;
            }
          }
        }
      }

      if (hasChanges) {
        // Update the plan in the database
        await pool.query(
          'UPDATE plans SET plan_json = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
          [JSON.stringify(plan), row.user_id]
        );
        console.log(`✅ Updated plan for user ${row.user_id}`);
      } else {
        console.log(`ℹ️  No changes needed for user ${row.user_id}`);
      }
    }

    console.log('\n✅ Plan database fix completed!');

  } catch (error) {
    console.error('❌ Error fixing plan database:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixPlanDatabase();
