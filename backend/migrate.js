// Lightweight, idempotent schema migrations run on every server boot.
//
// The app is deployed with `node server.js` (no separate migration step), and
// schema.sql only CREATEs tables IF NOT EXISTS — it never alters existing ones.
// So additive column changes are applied here with ADD COLUMN IF NOT EXISTS and
// friends, which are safe to run repeatedly against an already-migrated DB.
const { pool } = require('./database.pg');

const STATEMENTS = [
  // Exercise categorisation + how each exercise is logged.
  `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'strength'`,
  `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS notes TEXT`,
  `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS tracking_type TEXT NOT NULL DEFAULT 'weight_reps'`,
  // Mobility sets log a hold duration (or nothing, for a plain check-off)
  // instead of weight/reps, so those columns must be nullable.
  `ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS duration_seconds INTEGER`,
  `ALTER TABLE workout_sets ALTER COLUMN weight DROP NOT NULL`,
  `ALTER TABLE workout_sets ALTER COLUMN reps DROP NOT NULL`,
];

async function runMigrations() {
  for (const sql of STATEMENTS) {
    try {
      await pool.query(sql);
    } catch (err) {
      // Log and continue: a failed additive migration shouldn't stop the
      // server from booting and serving existing functionality.
      console.error('Migration statement failed:', sql, '-', err.message);
    }
  }
  console.log('Schema migrations complete.');
}

module.exports = { runMigrations };
