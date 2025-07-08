const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'workout.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// Initialize database tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Exercises table
      db.run(`
        CREATE TABLE IF NOT EXISTS exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          muscle_group TEXT NOT NULL,
          category TEXT DEFAULT 'strength',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Workouts table (add user_id)
      db.run(`
        CREATE TABLE IF NOT EXISTS workouts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          date DATE NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Workout sets table (add user_id)
      db.run(`
        CREATE TABLE IF NOT EXISTS workout_sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          workout_id INTEGER NOT NULL,
          exercise_id INTEGER NOT NULL,
          weight REAL NOT NULL,
          reps INTEGER NOT NULL,
          set_number INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
          FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating tables:', err.message);
          reject(err);
        } else {
          console.log('✅ Database tables created successfully');
          resolve();
        }
      });

      // Plans table
      db.run(`
        CREATE TABLE IF NOT EXISTS plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE NOT NULL,
          plan_json TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);
    });
  });
};

// Insert default exercises
const insertDefaultExercises = () => {
  const defaultExercises = [
    { name: 'Barbell bench press', muscle_group: 'Chest', category: 'strength' },
    { name: 'Incline barbell bench', muscle_group: 'Chest', category: 'strength' },
    { name: 'Cambered barbell bench', muscle_group: 'Chest', category: 'strength' },
    { name: 'Dumbbell flat bench', muscle_group: 'Chest', category: 'strength' },
    { name: 'Dumbbell incline bench', muscle_group: 'Chest', category: 'strength' },
    { name: 'Push-ups', muscle_group: 'Chest', category: 'bodyweight' },
    { name: 'Cable flies', muscle_group: 'Chest', category: 'strength' },
    { name: 'Dips', muscle_group: 'Triceps', category: 'bodyweight' },
    { name: 'Tricep extension', muscle_group: 'Triceps', category: 'strength' },
    { name: 'Overhead tricep extension', muscle_group: 'Triceps', category: 'strength' },
    { name: 'Dumbbell shoulder press', muscle_group: 'Front deltoid', category: 'strength' },
    { name: 'Overhead press', muscle_group: 'Front deltoid', category: 'strength' },
    { name: 'Dumbbell lateral raise', muscle_group: 'Side deltoid', category: 'strength' },
    { name: 'Rear delt dumbbell fly', muscle_group: 'Rear delt', category: 'strength' },
    { name: 'Rear delt cable fly', muscle_group: 'Rear delt', category: 'strength' },
    { name: 'EZ bar curl', muscle_group: 'Bicep', category: 'strength' },
    { name: 'Incline dumbbell curl', muscle_group: 'Bicep', category: 'strength' },
    { name: 'Machine preacher curl', muscle_group: 'Bicep', category: 'strength' },
    { name: 'Low bar squat', muscle_group: 'Quad', category: 'strength' },
    { name: 'High bar squat', muscle_group: 'Quad', category: 'strength' },
    { name: 'Leg press', muscle_group: 'Quad', category: 'strength' },
    { name: 'Hack squat', muscle_group: 'Quad', category: 'strength' },
    { name: 'Leg press calf raise', muscle_group: 'Calf', category: 'strength' },
    { name: 'SM calf raise', muscle_group: 'Calf', category: 'strength' },
    { name: 'Hack-squat calf raise', muscle_group: 'Calf', category: 'strength' },
    { name: 'Lunges', muscle_group: 'Glutes', category: 'strength' },
    { name: 'Pull-ups', muscle_group: 'Back', category: 'bodyweight' },
    { name: 'Deadlift', muscle_group: 'Back', category: 'strength' },
    { name: 'Barbell row', muscle_group: 'Back', category: 'strength' },
    { name: 'Seated cable row', muscle_group: 'Back', category: 'strength' },
    { name: 'Machine pull down', muscle_group: 'Back', category: 'strength' },
    { name: 'Cable lat pulldown', muscle_group: 'Back', category: 'strength' },
    { name: 'Stiff-legged DL', muscle_group: 'Hamstrings', category: 'strength' },
    { name: 'Hex bar shrugs', muscle_group: 'Trapezius', category: 'strength' },
    { name: 'Ab cable crunch', muscle_group: 'Abs', category: 'strength' },
    { name: 'Hanging leg raise', muscle_group: 'Abs', category: 'bodyweight' },
  ];

  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT OR IGNORE INTO exercises (name, muscle_group, category) VALUES (?, ?, ?)');
    
    defaultExercises.forEach(exercise => {
      stmt.run(exercise.name, exercise.muscle_group, exercise.category);
    });
    
    stmt.finalize((err) => {
      if (err) {
        console.error('Error inserting default exercises:', err.message);
        reject(err);
      } else {
        console.log('✅ Default exercises inserted successfully');
        resolve();
      }
    });
  });
};

function movingAverageNDailyMax(points, N = 60) {
  if (!points.length) return [];
  const dailyMax = getDailyMax1RM(points);
  const result = [];
  for (let i = 0; i < dailyMax.length; i++) {
    // Use up to N previous points (including current)
    const windowStart = Math.max(0, i - N + 1);
    const window = dailyMax.slice(windowStart, i + 1);
    const avg = window.reduce((sum, d) => sum + d.one_rm, 0) / window.length;
    result.push({
      date: dailyMax[i].date,
      ma: avg,
    });
  }
  return result;
}

module.exports = {
  db,
  initDatabase,
  insertDefaultExercises
}; 