const { pool } = require('./database.pg');

async function addPlansTable() {
  try {
    console.log('Adding plans table...');
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        plan_json JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await pool.query(createTableQuery);
    console.log('Plans table created successfully!');
    
    // Test the table
    const testQuery = await pool.query('SELECT * FROM plans LIMIT 1');
    console.log('Table test successful, found', testQuery.rows.length, 'rows');
    
  } catch (error) {
    console.error('Error creating plans table:', error);
  } finally {
    await pool.end();
  }
}

addPlansTable(); 