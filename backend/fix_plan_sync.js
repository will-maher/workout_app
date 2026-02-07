const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixPlanSync() {
  try {
    console.log('🔧 Fixing plan synchronization issues...\n');

    // Get current plan from database
    const result = await pool.query('SELECT user_id, plan_json FROM plans');
    
    if (result.rows.length === 0) {
      console.log('ℹ️ No plans found in database');
      return;
    }

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

      console.log('📋 Current plan keys:', Object.keys(plan));
      
      let hasChanges = false;
      
      // Fix day name from 'Wed AM' to 'Wednesday AM'
      if (plan['Wed AM']) {
        console.log('  Fixing "Wed AM" → "Wednesday AM"');
        plan['Wednesday AM'] = plan['Wed AM'];
        delete plan['Wed AM'];
        hasChanges = true;
      }

      // Ensure all default days exist
      const defaultDays = ['Monday AM', 'Tuesday AM', 'Wednesday AM', 'Thursday AM', 'Friday AM', 'Saturday AM', 'Sunday AM'];
      defaultDays.forEach(day => {
        if (!Array.isArray(plan[day])) {
          console.log(`  Adding missing day: ${day}`);
          plan[day] = [];
          hasChanges = true;
        }
      });

      // Remove any non-standard days
      const planKeys = Object.keys(plan);
      planKeys.forEach(key => {
        if (!defaultDays.includes(key)) {
          console.log(`  Removing non-standard day: ${key}`);
          delete plan[key];
          hasChanges = true;
        }
      });

      if (hasChanges) {
        // Update the plan in the database
        await pool.query(
          'UPDATE plans SET plan_json = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
          [JSON.stringify(plan), row.user_id]
        );
        console.log(`✅ Updated plan for user ${row.user_id}`);
        console.log('📋 New plan keys:', Object.keys(plan));
      } else {
        console.log(`ℹ️ No changes needed for user ${row.user_id}`);
      }
    }

    console.log('\n✅ Plan synchronization fix completed!');

  } catch (error) {
    console.error('❌ Error fixing plan sync:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixPlanSync();
