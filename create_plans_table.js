const { Pool } = require('pg');

// Use the same connection configuration as the backend
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@containers-us-west-207.railway.app:5432/railway',
  ssl: { rejectUnauthorized: false }
});

async function createPlansTable() {
  try {
    console.log('Connecting to database...');
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        plan_json JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    console.log('Creating plans table...');
    await pool.query(createTableQuery);
    console.log('Plans table created successfully!');
    
    // Verify the table exists
    const verifyQuery = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'plans'
    `);
    
    if (verifyQuery.rows.length > 0) {
      console.log('✅ Plans table verified and ready to use!');
    } else {
      console.log('❌ Plans table not found');
    }
    
  } catch (error) {
    console.error('Error creating plans table:', error);
  } finally {
    await pool.end();
  }
}

createPlansTable(); 