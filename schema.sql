-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create exercises table
CREATE TABLE IF NOT EXISTS exercises (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  muscle_group TEXT NOT NULL,
  category TEXT DEFAULT 'strength',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create workout_sets table
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