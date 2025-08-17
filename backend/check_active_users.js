const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkActiveUsers() {
  try {
    console.log('🔍 Checking user activity for the past week...\n');

    // Query 1: Active users with details
    console.log('📊 ACTIVE USERS (Past 7 Days):');
    console.log('================================');
    const activeUsersResult = await pool.query(`
      SELECT 
          u.id,
          u.username,
          u.created_at as user_created_at,
          COUNT(ws.id) as sets_logged_past_week,
          MIN(ws.created_at) as first_activity_this_week,
          MAX(ws.created_at) as last_activity_this_week
      FROM users u
      LEFT JOIN workout_sets ws ON u.id = ws.user_id 
          AND ws.created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY u.id, u.username, u.created_at
      HAVING COUNT(ws.id) > 0
      ORDER BY sets_logged_past_week DESC, last_activity_this_week DESC
    `);

    if (activeUsersResult.rows.length === 0) {
      console.log('❌ No active users found in the past week');
    } else {
      activeUsersResult.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.username}`);
        console.log(`   Sets logged: ${user.sets_logged_past_week}`);
        console.log(`   Last activity: ${user.last_activity_this_week}`);
        console.log(`   User since: ${user.user_created_at}`);
        console.log('');
      });
    }

    // Query 2: Summary statistics
    console.log('📈 SUMMARY STATISTICS:');
    console.log('======================');
    const summaryResult = await pool.query(`
      SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT CASE WHEN ws.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN u.id END) as active_users_past_week,
          ROUND(
              (COUNT(DISTINCT CASE WHEN ws.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN u.id END)::DECIMAL / 
               COUNT(DISTINCT u.id)) * 100, 2
          ) as active_user_percentage
      FROM users u
      LEFT JOIN workout_sets ws ON u.id = ws.user_id
    `);

    const summary = summaryResult.rows[0];
    console.log(`Total users: ${summary.total_users}`);
    console.log(`Active users (past week): ${summary.active_users_past_week}`);
    console.log(`Active user percentage: ${summary.active_user_percentage}%`);
    console.log('');

    // Query 3: Daily breakdown
    console.log('📅 DAILY ACTIVITY BREAKDOWN:');
    console.log('============================');
    const dailyResult = await pool.query(`
      SELECT 
          DATE(ws.created_at) as activity_date,
          COUNT(DISTINCT ws.user_id) as unique_users,
          COUNT(ws.id) as total_sets_logged
      FROM workout_sets ws
      WHERE ws.created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(ws.created_at)
      ORDER BY activity_date DESC
    `);

    if (dailyResult.rows.length === 0) {
      console.log('❌ No activity found in the past week');
    } else {
      dailyResult.rows.forEach(day => {
        console.log(`${day.activity_date}: ${day.unique_users} users, ${day.total_sets_logged} sets`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking active users:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkActiveUsers();
