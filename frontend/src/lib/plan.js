// Shared workout-plan model.
//
// Plans used to be an object keyed by day of week ({ 'Monday AM': [...] }),
// which tied every workout to a fixed day and made swapping them around
// awkward. Workouts are now a named, ordered list, so a plan is a set of
// templates you pick from rather than a calendar.
//
// v2 shape:
//   { version: 2, workouts: [ { id, name, exercises: [ Exercise ] } ] }
//   Exercise: { exercise, sets, targetReps, notes, supersetId }
//
// Exercises sharing a supersetId AND sitting next to each other form a
// superset. Keeping the marker on the exercise (rather than nesting groups)
// means ordering stays a single flat list, which is far easier to reorder.

export const PLAN_VERSION = 2;

const LEGACY_DAY_ORDER = [
  'Monday AM', 'Tuesday AM', 'Wednesday AM', 'Thursday AM',
  'Friday AM', 'Saturday AM', 'Sunday AM',
];

let idCounter = 0;
export const makeId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const makeExercise = (overrides = {}) => ({
  exercise: '',
  sets: 3,
  targetReps: 8,
  notes: '',
  supersetId: null,
  ...overrides,
});

export const makeWorkout = (name = 'New workout', exercises = []) => ({
  id: makeId('w'),
  name,
  exercises: exercises.map((e) => makeExercise(e)),
});

export const emptyPlan = () => ({ version: PLAN_VERSION, workouts: [] });

const normalizeExercise = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.exercise === 'string' ? raw.exercise : '';
  const sets = parseInt(raw.sets, 10);
  const reps = parseInt(raw.targetReps, 10);
  return {
    exercise: name,
    sets: Number.isFinite(sets) && sets > 0 ? sets : 3,
    targetReps: Number.isFinite(reps) && reps > 0 ? reps : null,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    supersetId: typeof raw.supersetId === 'string' ? raw.supersetId : null,
  };
};

const normalizeWorkout = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const exercises = (Array.isArray(raw.exercises) ? raw.exercises : [])
    .map(normalizeExercise)
    .filter(Boolean);
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId('w'),
    name: (typeof raw.name === 'string' && raw.name.trim()) ? raw.name.trim() : 'Untitled workout',
    exercises: dropOrphanSupersets(exercises),
  };
};

// Accepts either shape and always returns a valid v2 plan. Unrecognised input
// yields an empty plan rather than throwing, so a corrupt cache can't break the
// screen.
export const migratePlan = (raw) => {
  if (!raw || typeof raw !== 'object') return emptyPlan();

  if (Array.isArray(raw.workouts)) {
    return {
      version: PLAN_VERSION,
      workouts: raw.workouts.map(normalizeWorkout).filter(Boolean),
    };
  }

  // Legacy day-keyed object. Days with no exercises were rest days — carrying
  // them over would just be empty cards, so they're dropped.
  const keys = Object.keys(raw);
  const ordered = [
    ...LEGACY_DAY_ORDER.filter((d) => keys.includes(d)),
    ...keys.filter((k) => !LEGACY_DAY_ORDER.includes(k)),
  ];
  const workouts = ordered
    .filter((key) => Array.isArray(raw[key]) && raw[key].length > 0)
    .map((key) => normalizeWorkout({ name: key, exercises: raw[key] }))
    .filter(Boolean);

  return { version: PLAN_VERSION, workouts };
};

// A supersetId used by only one exercise, or by exercises that are no longer
// adjacent, is meaningless — clear it so rendering never shows a one-item
// superset or a split bracket.
export function dropOrphanSupersets(exercises) {
  return exercises.map((ex, i) => {
    if (!ex.supersetId) return ex;
    const prev = exercises[i - 1];
    const next = exercises[i + 1];
    const joined = (prev && prev.supersetId === ex.supersetId)
      || (next && next.supersetId === ex.supersetId);
    return joined ? ex : { ...ex, supersetId: null };
  });
}

// Runs of adjacent exercises sharing a supersetId, for rendering.
// Returns [{ supersetId, items: [{ exercise, index }] }].
export function groupExercises(exercises) {
  const groups = [];
  (exercises || []).forEach((ex, index) => {
    const last = groups[groups.length - 1];
    if (ex.supersetId && last && last.supersetId === ex.supersetId) {
      last.items.push({ exercise: ex, index });
    } else {
      groups.push({ supersetId: ex.supersetId || null, items: [{ exercise: ex, index }] });
    }
  });
  return groups;
}

// Total planned sets for a workout.
export const totalSets = (workout) =>
  (workout?.exercises || []).reduce((sum, ex) => sum + (parseInt(ex.sets, 10) || 0), 0);

// Sets per muscle group for one workout, descending.
export function musclesForWorkout(workout, exerciseMap) {
  const counts = {};
  (workout?.exercises || []).forEach((ex) => {
    const muscle = exerciseMap?.[ex.exercise]?.muscle_group;
    if (!muscle) return;
    counts[muscle] = (counts[muscle] || 0) + (parseInt(ex.sets, 10) || 0);
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// Optimal weekly set / frequency guidance per muscle group. Lives here rather
// than in a view so both the planner and the performance tab can read it.
export const OPTIMAL_RANGES = {
  'Chest': { sets: '12-20', freq: '1.5-3x' },
  'Anterior deltoid': { sets: '6-8', freq: '2-4x' },
  'Triceps': { sets: '10-14', freq: '2-4x' },
  'Bicep': { sets: '14-20', freq: '2-6x' },
  'Lateral deltoid': { sets: '16-22', freq: '2-6x' },
  'Quad': { sets: '12-18', freq: '1.5-3x' },
  'Calf': { sets: '12-16', freq: '2-6x' },
  'Glutes': { sets: '4-12', freq: '2-3x' },
  'Back': { sets: '14-22', freq: '2-6x' },
  'Hamstring': { sets: '10-16', freq: '2-3x' },
  'Trapezius': { sets: '12-20', freq: '2-4x' },
  'Abs': { sets: '10-14', freq: '2-4x' },
  'Posterior deltoid': { sets: '16-22', freq: '2-6x' },
};
