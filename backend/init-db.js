const { initDatabase, insertDefaultExercises } = require('./database');

async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Initialize database tables
    await initDatabase();
    
    // Insert default exercises
    await insertDefaultExercises();
    
    console.log('✅ Database initialization completed successfully!');
    console.log('📊 Default exercises have been added to the library.');
    console.log('🚀 You can now start the server with: npm run dev');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run initialization
initializeDatabase(); 