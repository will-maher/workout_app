const { db } = require('../database');
const { format, subDays, addDays } = require('date-fns');

const NUM_DAYS = 365;
const MAX_EXERCISES_PER_DAY = 2;
const MAX_SETS_PER_EXERCISE = 5;
const NOTES = [
  '',
  'Felt strong today',
  'Tough set',
  'Form was good',
  'Tried a new grip',
  'Focused on tempo',
  'Added a drop set',
  'Short rest',
  'PR attempt',
  'Light day',
];

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max, step = 0.5) {
  const val = Math.random() * (max - min) + min;
  return Math.round(val / step) * step;
}

async function generateDummyData() {
  db.all('SELECT * FROM exercises', async (err, exercises) => {
    if (err) {
      console.error('Error fetching exercises:', err);
      process.exit(1);
    }
    const today = new Date();
    for (let i = NUM_DAYS; i >= 0; i--) {
      const date = format(subDays(today, i), 'yyyy-MM-dd');
      const numExercises = getRandomInt(0, MAX_EXERCISES_PER_DAY);
      const chosenExercises = [];
      for (let e = 0; e < numExercises; e++) {
        // Pick a random exercise not already chosen for this day
        let exercise;
        do {
          exercise = exercises[getRandomInt(0, exercises.length - 1)];
        } while (chosenExercises.includes(exercise.id));
        chosenExercises.push(exercise.id);
        const numSets = getRandomInt(1, MAX_SETS_PER_EXERCISE);
        const sets = [];
        for (let s = 1; s <= numSets; s++) {
          // Generate reps/weight based on muscle group
          let reps = getRandomInt(5, 15);
          let weight = getRandomFloat(20, 100);
          if (exercise.muscle_group.toLowerCase().includes('calf') || exercise.muscle_group.toLowerCase().includes('quad') || exercise.muscle_group.toLowerCase().includes('glute')) {
            weight = getRandomFloat(40, 160);
            reps = getRandomInt(6, 20);
          }
          if (exercise.muscle_group.toLowerCase().includes('abs')) {
            weight = getRandomFloat(0, 20);
            reps = getRandomInt(10, 25);
          }
          if (exercise.muscle_group.toLowerCase().includes('bicep') || exercise.muscle_group.toLowerCase().includes('tricep')) {
            weight = getRandomFloat(5, 40);
            reps = getRandomInt(8, 15);
          }
          const notes = NOTES[getRandomInt(0, NOTES.length - 1)];
          sets.push({
            exercise_id: exercise.id,
            weight,
            reps,
            set_number: s,
            notes,
          });
        }
        // Insert workout and sets
        await new Promise((resolve, reject) => {
          db.run('INSERT INTO workouts (date) VALUES (?)', [date], function (err) {
            if (err) return reject(err);
            const workoutId = this.lastID;
            const stmt = db.prepare('INSERT INTO workout_sets (workout_id, exercise_id, weight, reps, set_number, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))');
            sets.forEach(set => {
              stmt.run(workoutId, set.exercise_id, set.weight, set.reps, set.set_number);
            });
            stmt.finalize(resolve);
          });
        });
      }
    }
    console.log('✅ Dummy data generated for the past year!');
    process.exit(0);
  });
}

generateDummyData(); 