const { Pool } = require('pg');

// Use the new Railway Postgres URL
const pool = new Pool({
  connectionString: 'postgresql://postgres:sAAucHrsUpBWiUzVGipPzLodrgyOXJcM@yamabiko.proxy.rlwy.net:28629/railway',
  ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
  try {
    console.log('🚀 Setting up new Railway database...');
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table ready');

    // Create exercises table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exercises (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        muscle_group TEXT NOT NULL,
        category TEXT DEFAULT 'strength',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Exercises table ready');

    // Create workouts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workouts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Workouts table ready');

    // Create workout_sets table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workout_sets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        workout_id INTEGER REFERENCES workouts(id) ON DELETE CASCADE,
        exercise_id INTEGER REFERENCES exercises(id) ON DELETE CASCADE,
        weight REAL NOT NULL,
        reps INTEGER NOT NULL,
        set_number INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Workout_sets table ready');

    // Create plans table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        plan_json JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Plans table ready');

    // Insert exercises data
    const exercises = [
      { name: 'Barbell bench press', muscle_group: 'Chest' },
      { name: 'Dumbbell shoulder press', muscle_group: 'Anterior deltoid' },
      { name: 'Dips', muscle_group: 'Triceps' },
      { name: 'Cable flies', muscle_group: 'Chest' },
      { name: 'EZ bar curl', muscle_group: 'Bicep' },
      { name: 'Dumbbell lateral raise', muscle_group: 'Lateral deltoid' },
      { name: 'Low bar squat', muscle_group: 'Quad' },
      { name: 'Hack squat', muscle_group: 'Quad' },
      { name: 'Leg press calf raise', muscle_group: 'Calf' },
      { name: 'Lunges', muscle_group: 'Quad' },
      { name: 'Leg extension', muscle_group: 'Quad' },
      { name: 'Pull-ups', muscle_group: 'Back' },
      { name: 'Barbell row', muscle_group: 'Back' },
      { name: 'Seated cable row', muscle_group: 'Back' },
      { name: 'Stiff-legged DL', muscle_group: 'Hamstring' },
      { name: 'Hex bar shrugs', muscle_group: 'Trapezius' },
      { name: 'Incline barbell bench press', muscle_group: 'Chest' },
      { name: 'Preacher curl', muscle_group: 'Bicep' },
      { name: 'Overhead tricep extension', muscle_group: 'Triceps' },
      { name: 'Incline dumbell curl', muscle_group: 'Bicep' },
      { name: 'Hanging leg raise', muscle_group: 'Abs' },
      { name: 'High bar squat', muscle_group: 'Quad' },
      { name: 'Leg press', muscle_group: 'Quad' },
      { name: 'Rear delt cable fly', muscle_group: 'Posterior deltoid' },
      { name: 'Deadlift', muscle_group: 'Back' },
      { name: 'Cable lat pulldown', muscle_group: 'Back' },
      { name: 'Ab cable crunch', muscle_group: 'Abs' }
    ];

    console.log('📝 Inserting exercises...');
    for (const exercise of exercises) {
      await pool.query(
        'INSERT INTO exercises (name, muscle_group) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [exercise.name, exercise.muscle_group]
      );
    }
    console.log('✅ Exercises inserted');

    // Create a test user with proper bcrypt hash
    const bcrypt = require('bcryptjs');
    const testPassword = 'test123';
    const passwordHash = bcrypt.hashSync(testPassword, 10);
    
    console.log('👤 Creating test user...');
    await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
      ['testuser', passwordHash]
    );
    console.log('✅ Test user created (username: testuser, password: test123)');

    // Verify all tables exist and have data
    console.log('\n📊 Database verification:');
    const tables = ['users', 'exercises', 'workouts', 'workout_sets', 'plans'];
    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   ${table}: ${result.rows[0].count} rows`);
    }

    console.log('\n🎉 New Railway database setup completed successfully!');
    console.log('🔗 You can now use the app with the new database.');
    console.log('📝 Test credentials: username: testuser, password: test123');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
  } finally {
    await pool.end();
  }
}

setupDatabase(); 