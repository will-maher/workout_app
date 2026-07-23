import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Slider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subMonths, differenceInCalendarDays, parseISO } from 'date-fns';
import axios from 'axios';
import { API_BASE_URL } from '../App';
import ScrollablePicker from './ScrollablePicker';

const StrengthCurveChart = React.memo(({ historicalSets, currentSets }) => {
  const data = useMemo(() => {
    const monthMap = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                       Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
    const parseDateKey = (df) => {
      if (!df) return null;
      const m = df.match(/(\d{2})\s+(\w{3})\s+(\d{2})/);
      return m ? `20${m[3]}-${monthMap[m[2]]}-${m[1]}` : null;
    };
    const sixAgo = format(subMonths(new Date(), 6), 'yyyy-MM-dd');

    const byReps = {};
    historicalSets.forEach(s => {
      const d = parseDateKey(s.date_formatted);
      if (!d || d < sixAgo) return;
      const r = parseInt(s.reps, 10);
      const w = parseFloat(s.weight);
      if (r >= 1 && r <= 30 && w > 0) {
        if (!byReps[r]) byReps[r] = [];
        byReps[r].push(w);
      }
    });

    const rKeys = Object.keys(byReps).map(Number).sort((a, b) => a - b);
    const ribbonPts = rKeys.map(r => {
      const sorted = [...byReps[r]].sort((a, b) => a - b);
      const n = sorted.length;
      const median = n % 2 === 0 ? (sorted[n/2-1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
      return { r, min: sorted[0], max: sorted[n-1], median };
    });

    const curPts = (currentSets || []).map(s => ({
      r: parseInt(s.reps, 10),
      w: parseFloat(s.weight),
    })).filter(p => p.r >= 1 && p.r <= 30 && p.w > 0);

    if (ribbonPts.length === 0 && curPts.length === 0) return null;

    const allW = [...ribbonPts.flatMap(p => [p.min, p.max]), ...curPts.map(p => p.w)];
    const allR = [...rKeys, ...curPts.map(p => p.r)];

    return {
      ribbonPts,
      curPts,
      xMin: Math.max(1, Math.min(...allR) - 1),
      xMax: Math.min(30, Math.max(...allR) + 2),
      yMin: Math.floor(Math.min(...allW) * 0.90),
      yMax: Math.ceil(Math.max(...allW) * 1.06),
    };
  }, [historicalSets, currentSets]);

  if (!data) return null;

  const { ribbonPts, curPts, xMin, xMax, yMin, yMax } = data;
  const W = 300, H = 130, PL = 34, PR = 8, PT = 6, PB = 22;
  const iW = W - PL - PR, iH = H - PT - PB;
  const xS = r => PL + ((r - xMin) / (xMax - xMin)) * iW;
  const yS = w => PT + (1 - (w - yMin) / (yMax - yMin)) * iH;

  const topEdge = ribbonPts.map(p => `${xS(p.r).toFixed(1)},${yS(p.max).toFixed(1)}`).join(' ');
  const botEdge = [...ribbonPts].reverse().map(p => `${xS(p.r).toFixed(1)},${yS(p.min).toFixed(1)}`).join(' ');
  const ribbonPoly = ribbonPts.length >= 2 ? `${topEdge} ${botEdge}` : null;
  const medianD = ribbonPts.map((p, i) => `${i===0?'M':'L'}${xS(p.r).toFixed(1)},${yS(p.median).toFixed(1)}`).join(' ');

  const spread = yMax - yMin;
  const tStep = spread <= 20 ? 5 : spread <= 60 ? 10 : spread <= 120 ? 20 : 50;
  const yTicks = [];
  for (let w = Math.ceil(yMin/tStep)*tStep; w <= yMax; w += tStep) yTicks.push(w);

  const xSpan = xMax - xMin;
  const xStep = xSpan <= 6 ? 1 : xSpan <= 14 ? 2 : 5;
  const xTicks = [];
  for (let r = Math.ceil(xMin/xStep)*xStep; r <= xMax; r += xStep) xTicks.push(r);

  const teal = '#00d4aa';

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      {yTicks.map(w => (
        <line key={w} x1={PL} x2={W-PR} y1={yS(w)} y2={yS(w)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
      {ribbonPoly && <polygon points={ribbonPoly} fill={`${teal}28`} />}
      {ribbonPts.length >= 2 && <>
        <polyline points={ribbonPts.map(p=>`${xS(p.r).toFixed(1)},${yS(p.max).toFixed(1)}`).join(' ')} fill="none" stroke={`${teal}55`} strokeWidth="1" strokeDasharray="3 2" />
        <polyline points={ribbonPts.map(p=>`${xS(p.r).toFixed(1)},${yS(p.min).toFixed(1)}`).join(' ')} fill="none" stroke={`${teal}55`} strokeWidth="1" strokeDasharray="3 2" />
        <path d={medianD} fill="none" stroke={teal} strokeWidth="2" strokeLinejoin="round" />
      </>}
      {ribbonPts.map(p => <circle key={p.r} cx={xS(p.r)} cy={yS(p.median)} r="2.5" fill={teal} />)}
      {curPts.map((p, i) => (
        <g key={i}>
          <circle cx={xS(p.r)} cy={yS(p.w)} r="6" fill={teal} opacity="0.18" />
          <circle cx={xS(p.r)} cy={yS(p.w)} r="3.5" fill={teal} stroke="#0a0a0a" strokeWidth="1.5" />
        </g>
      ))}
      <line x1={PL} x2={PL} y1={PT} y2={PT+iH} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <line x1={PL} x2={W-PR} y1={PT+iH} y2={PT+iH} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {yTicks.map(w => (
        <text key={w} x={PL-4} y={yS(w)+3} textAnchor="end" fontSize="8.5" fill="rgba(255,255,255,0.35)">{w}</text>
      ))}
      {xTicks.map(r => (
        <text key={r} x={xS(r)} y={H-5} textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.35)">{r}</text>
      ))}
      <text x={W-PR+3} y={H-5} textAnchor="start" fontSize="7.5" fill="rgba(255,255,255,0.22)">reps</text>
      <text x={PL-4} y={PT-1} textAnchor="end" fontSize="7.5" fill="rgba(255,255,255,0.22)">kg</text>
    </svg>
  );
});

const WorkoutEntry = ({ onStatusMessage }) => {
  const setMessage = onStatusMessage ?? (() => {});
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [recentSets, setRecentSets] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sliderReps, setSliderReps] = useState(8); // Default to 8 reps for slider
  const [userPlan, setUserPlan] = useState(null);
  const [selectedPlannedWorkout, setSelectedPlannedWorkout] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [recentExerciseIds, setRecentExerciseIds] = useState([]);
  const [showPlannedExercises, setShowPlannedExercises] = useState(() => {
    try {
      const v = localStorage.getItem('planned_exercises_expanded');
      return v === null ? true : v === 'true';
    } catch { return true; }
  });
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [oneRmRanges, setOneRmRanges] = useState({});
  const [goals, setGoals] = useState([]);
  const [temporaryExercises, setTemporaryExercises] = useState([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const haptic = (ms = 10) => { try { navigator.vibrate?.(ms); } catch {} };

  // Remember whether the planned exercise list is collapsed between visits.
  useEffect(() => {
    try { localStorage.setItem('planned_exercises_expanded', String(showPlannedExercises)); } catch {}
  }, [showPlannedExercises]);
  const adjustWeight = (delta) => {
    const next = Math.max(0, (parseFloat(weight) || 0) + delta);
    const rounded = Math.round(next * 10) / 10;
    setWeight(rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1));
  };

  const inputSurface = 'background.paper';

  const smallTextSize = 11;
  const sectionGap = 2;
  const smallGap = 1;

  const sectionSx = {
    pb: 1.5,
    borderBottom: '1px solid',
    borderColor: 'divider',
  };

  const sectionTitleSx = {
    mb: smallGap,
    fontWeight: 700,
    fontSize: smallTextSize,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'text.secondary',
  };

  // Generate reps options (1-50)
  const repsOptions = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `${i + 1} reps` }));

  // Calculate weight for given reps using Brzycki formula (reversed)
  const calculateWeightForReps = (targetReps, oneRepMax) => {
    if (!oneRepMax || targetReps <= 0) return 0;
    // Brzycki formula reversed: weight = 1RM * (1.0278 - 0.0278 * reps)
    return oneRepMax * (1.0278 - 0.0278 * targetReps);
  };

  // Calculate 1RM from weight and reps (same as Performance tab)
  const calc1RM = (weight, reps) => {
    if (!weight || !reps) return 0;
    return weight / (1.0278 - 0.0278 * reps);
  };



  // Simple LOESS implementation (same as Performance tab)
  const loess = (xs, ys, bandwidth = 0.08) => {
    const n = xs.length;
    const bw = Math.max(2, Math.floor(bandwidth * n));
    const result = [];
    for (let i = 0; i < n; i++) {
      const distances = xs.map(x => Math.abs(x - xs[i]));
      const idxs = distances
        .map((d, idx) => [d, idx])
        .sort((a, b) => a[0] - b[0])
        .slice(0, bw)
        .map(pair => pair[1]);
      const xw = idxs.map(j => xs[j]);
      const yw = idxs.map(j => ys[j]);
      const xbar = xw.reduce((a, b) => a + b, 0) / bw;
      const ybar = yw.reduce((a, b) => a + b, 0) / bw;
      const num = xw.reduce((sum, xj, k) => sum + (xj - xbar) * (yw[k] - ybar), 0);
      const den = xw.reduce((sum, xj) => sum + (xj - xbar) ** 2, 0);
      const beta = den === 0 ? 0 : num / den;
      const alpha = ybar - beta * xbar;
      result.push([xs[i], alpha + beta * xs[i]]);
    }
    return result;
  };

  // Estimated 1RM using LOESS from performance data (heaviest set per workout)
  const estimatedOneRepMax = useMemo(() => {
    if (!selectedExercise || recentSets.length === 0) return 0;
    
    try {
      // Group sets by workout date and get the heaviest set from each workout
      const workoutGroups = {};
      recentSets.forEach(set => {
        // Extract date from the formatted date string (e.g., "15 Dec 23")
        const dateMatch = set.date_formatted.match(/(\d{2})\s+(\w{3})\s+(\d{2})/);
        if (dateMatch) {
          const [, day, month, year] = dateMatch;
          const monthMap = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
            'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
          };
          const dateKey = `20${year}-${monthMap[month]}-${day}`;
          
          if (!workoutGroups[dateKey]) {
            workoutGroups[dateKey] = [];
          }
          workoutGroups[dateKey].push(set);
        }
      });
      
      // Get the heaviest set from each workout
      const heaviestSetsPerWorkout = Object.entries(workoutGroups).map(([date, sets]) => {
        const heaviestSet = sets.reduce((max, set) => 
          calc1RM(set.weight, set.reps) > calc1RM(max.weight, max.reps) ? set : max
        );
        return {
          date: date,
          one_rm: calc1RM(heaviestSet.weight, heaviestSet.reps),
        };
      }).sort((a, b) => a.date.localeCompare(b.date));
      
      if (heaviestSetsPerWorkout.length < 2) {
        // If not enough data for LOESS, use the latest 1RM
        return heaviestSetsPerWorkout.length > 0 ? heaviestSetsPerWorkout[heaviestSetsPerWorkout.length - 1].one_rm : 0;
      }
      
      // Prepare data for LOESS
      const scatterData = heaviestSetsPerWorkout.map(pt => [
        new Date(pt.date).getTime(),
        pt.one_rm
      ]);
      
      const xs = scatterData.map(d => d[0]);
      const ys = scatterData.map(d => d[1]);
      
      // Calculate LOESS smoothed line
      const loessLine = loess(xs, ys, 0.08);
      
      // Return the latest LOESS estimate (most recent point)
      return loessLine.length > 0 ? loessLine[loessLine.length - 1][1] : 0;
    } catch (error) {
      console.error('Error calculating LOESS estimate:', error);
      // Fallback to latest set's 1RM
      return recentSets.length > 0 ? calc1RM(recentSets[0].weight, recentSets[0].reps) : 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExercise, recentSets]);

  // Round weight to nearest 2.5kg increment
  const roundToNearest2_5 = (weight) => {
    return Math.round(weight / 2.5) * 2.5;
  };

  // Get planned workout options
  const getPlannedWorkoutOptions = () => {
    if (!userPlan) return [];
    const dayOrder = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ];
    return Object.keys(userPlan)
      .sort((a, b) => {
        // Extract day part (e.g., 'Monday' from 'Monday AM')
        const dayA = dayOrder.findIndex(day => a.startsWith(day));
        const dayB = dayOrder.findIndex(day => b.startsWith(day));
        // If both found, sort by day order, else fallback to string compare
        if (dayA !== -1 && dayB !== -1) return dayA - dayB;
        if (dayA !== -1) return -1;
        if (dayB !== -1) return 1;
        return a.localeCompare(b);
      })
      .map(day => ({
        id: day,
        name: day
      }));
  };

  // Get exercises for selected planned workout
  const getSelectedWorkoutExercises = () => {
    if (!userPlan || !selectedPlannedWorkout) return [];
    return userPlan[selectedPlannedWorkout] || [];
  };

  const plannedWorkoutStats = useMemo(() => {
    const plannedExercises = userPlan && selectedPlannedWorkout
      ? (userPlan[selectedPlannedWorkout] || [])
      : [];
    if (!plannedExercises.length) {
      return { total: 0, completed: 0 };
    }

    const plannedCounts = plannedExercises.reduce((acc, ex) => {
      const key = ex.exercise;
      acc[key] = (acc[key] || 0) + (parseInt(ex.sets, 10) || 0);
      return acc;
    }, {});

    const total = Object.values(plannedCounts).reduce((sum, count) => sum + count, 0);

    const completedCounts = sets.reduce((acc, set) => {
      const key = set.exercise_name;
      if (!plannedCounts[key]) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const completed = Object.keys(plannedCounts).reduce((sum, key) => {
      const planned = plannedCounts[key] || 0;
      const done = completedCounts[key] || 0;
      return sum + Math.min(planned, done);
    }, 0);

    return { total, completed };
  }, [sets, userPlan, selectedPlannedWorkout]);

  // Group exercises by muscle group
  const groupedExercises = useMemo(() => {
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return [];
    }

    const grouped = exercises.reduce((acc, exercise) => {
      const muscleGroup = exercise.muscle_group || 'Other';
      if (!acc[muscleGroup]) {
        acc[muscleGroup] = [];
      }
      acc[muscleGroup].push(exercise);
      return acc;
    }, {});

    // Convert to array format and sort
    return Object.keys(grouped)
      .sort()
      .map(muscleGroup => ({
        label: muscleGroup,
        items: grouped[muscleGroup].sort((a, b) => a.name.localeCompare(b.name))
      }));
  }, [exercises]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('recent_exercises');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentExerciseIds(parsed);
        }
      }
    } catch (error) {
      console.warn('Unable to load recent exercises:', error);
    }
  }, []);

  useEffect(() => {
    if (!selectedExercise) return;
    const selectedId = parseInt(selectedExercise, 10);
    if (!selectedId) return;
    setRecentExerciseIds((prev) => {
      const updated = [selectedId, ...prev.filter((id) => id !== selectedId)].slice(0, 3);
      try {
        localStorage.setItem('recent_exercises', JSON.stringify(updated));
      } catch (error) {
        console.warn('Unable to save recent exercises:', error);
      }
      return updated;
    });
  }, [selectedExercise]);

  const recentExercises = useMemo(() => {
    if (!recentExerciseIds.length) return [];
    const exerciseMap = new Map(exercises.map((ex) => [ex.id, ex]));
    return recentExerciseIds
      .map((id) => exerciseMap.get(id))
      .filter(Boolean);
  }, [recentExerciseIds, exercises]);

  useEffect(() => {
    const initializeComponent = async () => {
      setIsInitializing(true);
      
      // Add timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        setIsInitializing(false);
      }, 10000); // 10 second timeout
      
      try {
        await fetchExercises();
        await fetchUserPlan();
        await fetchGoals();
      } catch (error) {
        console.error('Error initializing WorkoutEntry component:', error);
      } finally {
        clearTimeout(timeoutId);
        setIsInitializing(false);
      }
    };
    
    initializeComponent();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchExercises = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/exercises`);
      // Ensure exercises is always an array
      const exercisesArray = Array.isArray(response.data) ? response.data : [];
      setExercises(exercisesArray);
    } catch (error) {
      console.error('Error loading exercises:', error);
      setMessage('Error loading exercises');
      setExercises([]); // Set empty array on error
    }
  };

  const fetchUserPlan = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/plan`);
      if (response.data) {
        // Migrate 'Wed AM' to 'Wednesday AM' if present
        let plan = { ...response.data };
        if (plan['Wed AM']) {
          plan['Wednesday AM'] = plan['Wed AM'];
          delete plan['Wed AM'];
        }
        setUserPlan(plan);
      } else {
        setUserPlan(null);
      }
    } catch (error) {
      console.error('Error loading user plan:', error);
      setUserPlan(null);
    }
  };

  const fetchGoals = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/goals`);
      setGoals(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setGoals([]);
    }
  };

  const activeGoal = useMemo(() => {
    if (!selectedExercise || !goals.length) return null;
    return goals.find((g) => g.exercise_id === parseInt(selectedExercise, 10)) || null;
  }, [goals, selectedExercise]);

  const daysToGoal = useMemo(() => {
    if (!activeGoal) return null;
    return Math.max(0, differenceInCalendarDays(parseISO(activeGoal.target_date), new Date()));
  }, [activeGoal]);

  const fetchRecentData = useCallback(async () => {
    if (!selectedExercise) {
      setRecentSets([]);
      return;
    }
    try {
      setLoadingData(true);
      const response = await axios.get(`${API_BASE_URL}/api/stats/recent-sets?exercise_id=${selectedExercise}&limit=200`);
      setRecentSets(response.data);
    } catch (error) {
      console.error('Error fetching recent data:', error);
      setRecentSets([]);
    } finally {
      setLoadingData(false);
    }
  }, [selectedExercise]);

  useEffect(() => {
    if (selectedExercise !== '') {
      setWeight('');
      setReps('');
      fetchRecentData();
    }
  }, [selectedExercise, fetchRecentData]);

  const currentExerciseSets = useMemo(
    () => sets.filter(s => s.exercise_id === parseInt(selectedExercise, 10)),
    [sets, selectedExercise]
  );

  useEffect(() => {
    if (!selectedExercise) return;
    const goal = goals.find((g) => g.exercise_id === parseInt(selectedExercise, 10));
    if (goal) setSliderReps(5);
  }, [selectedExercise, goals]);

  // When the selected day changes, discard temporary exercises
  useEffect(() => {
    setTemporaryExercises([]);
  }, [selectedPlannedWorkout]);

  // Auto-add the selected exercise to the plan view if it isn't already there
  useEffect(() => {
    if (!selectedExercise || !selectedPlannedWorkout || !userPlan) return;
    const exercise = exercises.find(ex => ex.id === parseInt(selectedExercise, 10));
    if (!exercise) return;
    const planExercises = userPlan[selectedPlannedWorkout] || [];
    const isInPlan = planExercises.some(pe => pe.exercise === exercise.name);
    if (!isInPlan) {
      setTemporaryExercises(prev =>
        prev.some(te => te.id === exercise.id) ? prev : [...prev, exercise]
      );
    }
  }, [selectedExercise]); // eslint-disable-line react-hooks/exhaustive-deps

  // Validate numeric input
  const isNumeric = (val) => /^\d+(\.\d+)?$/.test(val);

  const handleAddSet = () => {
    if (!selectedExercise || !weight || !reps) {
      setMessage('Please fill in all fields');
      return;
    }
    if (!isNumeric(weight) || !isNumeric(reps)) {
      setMessage('Weight and reps must be numeric');
      return;
    }
    const exercise = exercises.find(ex => ex.id === parseInt(selectedExercise));
    const newSet = {
      id: Date.now(),
      exercise_id: parseInt(selectedExercise),
      exercise_name: exercise.name,
      muscle_group: exercise.muscle_group,
      weight: parseFloat(weight),
      reps: parseInt(reps),
      date: format(new Date(), 'yyyy-MM-dd'),
    };
    setSets([...sets, newSet]);
    haptic();
    setMessage('');
    setReps('');
  };

  const handleRemoveSet = (setId) => {
    setSets(sets.filter(set => set.id !== setId));
  };

  // --- LocalStorage persistence for sets ---
  // Load sets from localStorage on mount
  useEffect(() => {
    try {
      const savedSets = localStorage.getItem('workout_sets');
      if (savedSets) {
        const parsedSets = JSON.parse(savedSets);
        if (Array.isArray(parsedSets)) {
          setSets(parsedSets);
        } else {
          console.warn('Invalid sets data in localStorage, clearing...');
          localStorage.removeItem('workout_sets');
        }
      }
    } catch (e) {
      console.error('Error parsing localStorage sets:', e);
      // Clear corrupted localStorage
      localStorage.removeItem('workout_sets');
    }
  }, []);

  // Save sets to localStorage whenever they change
  useEffect(() => {
    try {
      if (sets.length > 0) {
        localStorage.setItem('workout_sets', JSON.stringify(sets));
      } else {
        // Only clear localStorage if sets are empty and we're not in the middle of loading
        const savedSets = localStorage.getItem('workout_sets');
        if (savedSets) {
          localStorage.removeItem('workout_sets');
        }
      }
    } catch (error) {
      console.error('Error saving sets to localStorage:', error);
    }
  }, [sets]);

  // --- LocalStorage persistence for selected planned workout ---
  // Load selected planned workout from localStorage on mount
  useEffect(() => {
    try {
      const savedPlannedWorkout = localStorage.getItem('selected_planned_workout');
      if (savedPlannedWorkout) {
        setSelectedPlannedWorkout(savedPlannedWorkout);
      }
    } catch (error) {
      console.error('Error loading selected planned workout from localStorage:', error);
      localStorage.removeItem('selected_planned_workout');
    }
  }, []);

  // Save selected planned workout to localStorage whenever it changes
  useEffect(() => {
    try {
      if (selectedPlannedWorkout) {
        localStorage.setItem('selected_planned_workout', selectedPlannedWorkout);
      } else {
        localStorage.removeItem('selected_planned_workout');
      }
    } catch (error) {
      console.error('Error saving selected planned workout to localStorage:', error);
    }
  }, [selectedPlannedWorkout]);

  const handleSaveSets = async () => {
    setSaveConfirmOpen(false);
    if (sets.length === 0) {
      setMessage('Please add at least one set');
      return;
    }
    try {
      setSaving(true);
      
      // Group sets by date
      const setsByDate = {};
      sets.forEach((set, index) => {
        if (!setsByDate[set.date]) {
          setsByDate[set.date] = [];
        }
        setsByDate[set.date].push({
          exercise_id: set.exercise_id,
          weight: set.weight,
          reps: set.reps,
          set_number: setsByDate[set.date].length + 1,
        });
      });
      
      // Save each date as a separate workout
      for (const [date, dateSets] of Object.entries(setsByDate)) {
        await axios.post(`${API_BASE_URL}/api/workouts`, {
          date: date,
          sets: dateSets,
        });
      }
      
      setMessage('Sets saved successfully!');
      haptic(20);
      setSets([]);
      localStorage.removeItem('workout_sets'); // Clear localStorage after saving
    } catch (error) {
      console.error('Error saving sets:', error);
      setMessage('Error saving sets: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const recentBestSets = useMemo(() => {
    if (!Array.isArray(recentSets) || recentSets.length === 0) {
      return [];
    }

    const toDate = (value) => {
      if (!value) return null;
      if (typeof value === 'string' && value.includes('-')) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const groupedByDate = recentSets.reduce((acc, set) => {
      const key = set.date_formatted || set.date;
      if (!key) return acc;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(set);
      return acc;
    }, {});

    const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
      const dateA = toDate(a);
      const dateB = toDate(b);
      if (!dateA || !dateB) return 0;
      return dateB - dateA;
    });

    return sortedDates.slice(0, 10).map((dateKey) => {
      const setsForDate = groupedByDate[dateKey];
      const bestSet = setsForDate.reduce((best, current) => {
        if (!best) return current;
        return Number(current.weight) > Number(best.weight) ? current : best;
      }, null);

      return {
        date: dateKey,
        weight: bestSet?.weight ?? 0,
        reps: bestSet?.reps ?? 0,
      };
    });
  }, [recentSets]);

  const bestSetPastYear = useMemo(() => {
    if (!Array.isArray(recentSets) || recentSets.length === 0) {
      return null;
    }

    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(now.getFullYear() - 1);

    const filtered = recentSets.filter((set) => {
      const rawDate = set.date || set.date_formatted;
      const parsed = rawDate ? new Date(rawDate) : null;
      if (!parsed || Number.isNaN(parsed.getTime())) return false;
      return parsed >= yearAgo && parsed <= now;
    });

    if (filtered.length === 0) return null;

    const bestSet = filtered.reduce((best, current) => {
      if (!best) return current;
      return Number(current.weight) > Number(best.weight) ? current : best;
    }, null);

    return {
      label: 'Past year best',
      weight: bestSet?.weight ?? 0,
      reps: bestSet?.reps ?? 0,
    };
  }, [recentSets]);

  // Fetch 6-month 1RM range per exercise when sets change
  useEffect(() => {
    if (sets.length === 0) {
      setOneRmRanges({});
      return;
    }
    const uniqueExerciseIds = [...new Set(sets.map((s) => s.exercise_id))];
    const sixMonthsAgo = format(subMonths(new Date(), 6), 'yyyy-MM-dd');
    const fetchRanges = async () => {
      const ranges = {};
      await Promise.all(
        uniqueExerciseIds.map(async (exerciseId) => {
          try {
            const res = await axios.get(`${API_BASE_URL}/api/stats/performance/sets?exercise_id=${exerciseId}`);
            const allSets = Array.isArray(res.data) ? res.data : [];
            const filtered = allSets.filter((row) => row.date && row.date >= sixMonthsAgo);
            const oneRMs = filtered.map((row) => calc1RM(row.weight, row.reps)).filter((v) => v > 0);
            if (oneRMs.length > 0) {
              ranges[exerciseId] = {
                min: Math.min(...oneRMs),
                max: Math.max(...oneRMs),
              };
            }
          } catch (err) {
            console.error('Error fetching 1RM range for exercise', exerciseId, err);
          }
        })
      );
      setOneRmRanges(ranges);
    };
    fetchRanges();
  }, [sets]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ maxWidth: 520, mx: 'auto', mt: 2, px: { xs: 1.5, sm: 0 }, '& .MuiTypography-root': { fontSize: 13 } }}>
        {isInitializing ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {/* Planned Workout Selector */}
              {userPlan && Object.keys(userPlan).length > 0 && (
                <Box sx={{ ...sectionSx, px: 0 }}>
                  <Box
                    onClick={() => { if (selectedPlannedWorkout) { haptic(); setShowPlannedExercises(p => !p); } }}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: smallGap,
                      cursor: selectedPlannedWorkout ? 'pointer' : 'default',
                      userSelect: 'none',
                      '&:hover .planned-toggle': selectedPlannedWorkout ? { color: 'text.primary' } : {},
                    }}
                  >
                    <Typography sx={{ ...sectionTitleSx, mb: 0 }}>Planned Workout</Typography>
                    {selectedPlannedWorkout && (
                      <Box className="planned-toggle" sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'text.secondary', transition: 'color 0.2s ease' }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' }}>
                          {showPlannedExercises ? 'Hide' : 'Show'}
                        </Typography>
                        <ExpandMoreIcon sx={{ fontSize: 16, transform: showPlannedExercises ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                      </Box>
                    )}
                  </Box>
                    
                  <ScrollablePicker
                    items={getPlannedWorkoutOptions()}
                    value={selectedPlannedWorkout}
                    onChange={setSelectedPlannedWorkout}
                    label="Select Planned Workout"
                    getItemLabel={(item) => item.name}
                    getItemValue={(item) => item.id}
                    inputBackground={inputSurface}
                  />

                  {selectedPlannedWorkout && plannedWorkoutStats.total > 0 && (
                    <Box sx={{ mt: sectionGap }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: smallGap }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 11 }}>
                          Workout progress
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, fontSize: 11 }}>
                          {plannedWorkoutStats.completed}/{plannedWorkoutStats.total} sets
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${plannedWorkoutStats.total}, minmax(0, 1fr))`,
                          gap: 0.5,
                        }}
                      >
                        {Array.from({ length: plannedWorkoutStats.total }).map((_, index) => {
                          const isComplete = index < plannedWorkoutStats.completed;
                          return (
                            <Box
                              key={index}
                              sx={{
                                height: 10,
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                                backgroundColor: isComplete ? 'primary.main' : 'transparent',
                                transition: 'background-color 0.2s ease',
                              }}
                            />
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                  
                  {/* Show exercises for selected workout */}
                  {selectedPlannedWorkout && (
                    <Box sx={{ mt: 1 }}>
                      {showPlannedExercises && (
                        <>
                          <Box sx={{ 
                            display: 'table', 
                            width: '100%',
                            borderCollapse: 'collapse'
                          }}>
                          {getSelectedWorkoutExercises().map((exercise, index) => {
                            const exerciseData = exercises.find(ex => ex.name === exercise.exercise);
                            return (
                              <Box
                                key={index}
                                onClick={() => {
                                  if (exerciseData) {
                                    setSelectedExercise(exerciseData.id);
                                    if (exercise.targetReps) {
                                      setReps(exercise.targetReps.toString());
                                    }
                                  }
                                }}
                                sx={{
                                  display: 'table-row',
                                  cursor: exerciseData ? 'pointer' : 'default',
                                  '&:hover': {
                                    bgcolor: exerciseData && selectedExercise === exerciseData.id ? 'primary.dark' : 'background.paper'
                                  },
                                  bgcolor: exerciseData && selectedExercise === exerciseData.id ? 'primary.main' : 'transparent',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <Box sx={{
                                  display: 'table-cell',
                                  py: 0.75,
                                  px: 1,
                                  borderBottom: '1px solid',
                                  borderColor: 'divider',
                                  verticalAlign: 'middle'
                                }}>
                                  <Typography
                                    variant="body2"
                                    color={exerciseData && selectedExercise === exerciseData.id ? 'primary.contrastText' : 'text.primary'}
                                    sx={{
                                      fontSize: 13,
                                      fontWeight: 500
                                    }}
                                  >
                                    {exercise.exercise}
                                  </Typography>
                                </Box>
                                <Box sx={{
                                  display: 'table-cell',
                                  py: 0.75,
                                  px: 1,
                                  borderBottom: '1px solid',
                                  borderColor: 'divider',
                                  verticalAlign: 'middle',
                                  textAlign: 'right',
                                  width: '120px'
                                }}>
                                  <Typography
                                    variant="body2"
                                    color={exerciseData && selectedExercise === exerciseData.id ? 'primary.contrastText' : 'text.secondary'}
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: 13
                                    }}
                                  >
                                    {exercise.sets} × {exercise.targetReps || '?'}
                                  </Typography>
                                </Box>
                              </Box>
                            );
                          })}
                          {temporaryExercises.map((exercise) => {
                            const isSelected = selectedExercise === exercise.id;
                            return (
                              <Box
                                key={`tmp-${exercise.id}`}
                                onClick={() => setSelectedExercise(exercise.id)}
                                sx={{
                                  display: 'table-row',
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                                  bgcolor: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent',
                                  transition: 'background-color 0.2s ease',
                                }}
                              >
                                <Box sx={{ display: 'table-cell', py: 0.75, px: 1, borderBottom: '1px dashed', borderColor: 'divider', verticalAlign: 'middle' }}>
                                  <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 400, fontStyle: 'italic', color: 'text.secondary' }}>
                                    {exercise.name}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'table-cell', py: 0.75, px: 1, borderBottom: '1px dashed', borderColor: 'divider', verticalAlign: 'middle', textAlign: 'right', width: '120px' }}>
                                  <Typography variant="body2" sx={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                                    extra
                                  </Typography>
                                </Box>
                              </Box>
                            );
                          })}
                          </Box>
                          {/* Show notes if any exercise has them */}
                          {getSelectedWorkoutExercises().some(ex => ex.notes) && (
                            <Box sx={{ mt: sectionGap, p: sectionGap, bgcolor: 'background.default', borderRadius: 2 }}>
                              {getSelectedWorkoutExercises().map((exercise, index) => {
                                if (!exercise.notes) return null;
                                return (
                                  <Typography 
                                    key={index}
                                    variant="caption" 
                                    color="text.secondary"
                                    sx={{ 
                                      display: 'block',
                                      fontSize: 11,
                                      fontStyle: 'italic',
                                      opacity: 0.8,
                                      mb: 0.5
                                    }}
                                  >
                                    <strong>{exercise.exercise}:</strong> {exercise.notes}
                                  </Typography>
                                );
                              })}
                            </Box>
                          )}
                        </>
                      )}
                    </Box>
                  )}
                </Box>
              )}
            
            {/* Main Form */}
            <Box sx={{ ...sectionSx, px: 0 }}>
                {/* Header spacer removed for compact layout */}
                
                {/* Exercise Selection */}
                <Box sx={{ mb: sectionGap }}>
                  <ScrollablePicker
                    items={
                      groupedExercises.length > 0
                        ? [
                            ...(recentExercises.length > 0
                              ? [{ label: 'Recent', items: recentExercises }]
                              : []),
                            ...groupedExercises,
                          ]
                        : [{ label: 'Loading...', items: [] }]
                    }
                    value={selectedExercise}
                    onChange={setSelectedExercise}
                    label="Select Exercise"
                    getItemLabel={(item) => item.name}
                    getItemValue={(item) => item.id}
                    grouped={true}
                    getGroupLabel={(group) => group.label}
                    searchEnabled={true}
                    searchPlaceholder="Search exercises..."
                    inputBackground={inputSurface}
                  autoFocusSearch={!isMobile}
                  />
                  {/* Exercise Notes Display */}
                  {selectedExercise && (() => {
                    const selectedExerciseData = exercises.find(ex => ex.id === parseInt(selectedExercise));
                    return selectedExerciseData && selectedExerciseData.notes ? (
                      <Box sx={{ mt: 1, p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          sx={{ 
                            fontStyle: 'italic',
                            lineHeight: 1.5
                          }}
                        >
                          {selectedExerciseData.notes}
                        </Typography>
                      </Box>
                    ) : null;
                  })()}
                </Box>

                {/* Active goal card */}
                {activeGoal && (
                  <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'text.secondary' }}>
                        Goal{daysToGoal !== null ? ` · ${daysToGoal}d left` : ''}
                      </Typography>
                      <Chip
                        label={activeGoal.achieved ? 'achieved' : activeGoal.on_track ? 'on track' : 'behind'}
                        size="small"
                        sx={{ fontSize: 10, height: 18, fontWeight: 600, color: '#04342C', backgroundColor: activeGoal.achieved ? '#9FE1CB' : activeGoal.on_track ? '#5DCAA5' : '#FAC775' }}
                      />
                    </Box>
                    <Box sx={{ height: 4, borderRadius: 2, backgroundColor: 'divider', mb: 1 }}>
                      <Box sx={{ height: '100%', borderRadius: 2, width: `${activeGoal.progress * 100}%`, backgroundColor: 'primary.main', transition: 'width 0.4s ease' }} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                        <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{activeGoal.current_one_rm} kg</Box>
                        {' → '}
                        <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{activeGoal.target_one_rm} kg</Box>
                      </Typography>
                      <Box
                        component="button"
                        onClick={() => {
                          setWeight(roundToNearest2_5(activeGoal.expected_one_rm * (1.0278 - 0.0278 * 5)).toString());
                          setReps('5');
                          haptic();
                        }}
                        sx={{ background: 'none', border: 'none', cursor: 'pointer', p: 0, display: 'inline-flex', alignItems: 'baseline' }}
                      >
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                          aim for{' '}
                          <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>
                            {roundToNearest2_5(activeGoal.expected_one_rm * (1.0278 - 0.0278 * 5))} kg × 5
                          </Box>
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Weight Calculator Slider */}
                {selectedExercise && estimatedOneRepMax > 0 && (
                  <Box sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: smallGap }}>
                      <Typography variant="h6" color="primary.main" fontWeight={600} sx={{ fontSize: 13 }}>
                        {roundToNearest2_5(calculateWeightForReps(sliderReps, estimatedOneRepMax))} kg · {sliderReps} reps
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 11 }}>
                        est. 1RM {roundToNearest2_5(estimatedOneRepMax)} kg
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: sectionGap }}>
                      <Box sx={{ flex: 3 }}>
                      <Slider
                        value={sliderReps}
                        onChange={(event, newValue) => setSliderReps(newValue)}
                        min={1}
                        max={20}
                        step={1}
                        marks={[
                          { value: 1 }, { value: 5 }, { value: 10 }, { value: 15 }, { value: 20 },
                        ]}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value}`}
                        sx={{
                        '& .MuiSlider-valueLabel': {
                          fontSize: 11,
                        },
                          '& .MuiSlider-track': {
                            height: 3,
                          },
                          '& .MuiSlider-thumb': {
                            width: 16,
                            height: 16,
                          }
                        }}
                      />
                      </Box>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => {
                          setReps(sliderReps.toString());
                          setWeight(roundToNearest2_5(calculateWeightForReps(sliderReps, estimatedOneRepMax)).toString());
                        }}
                        sx={{
                          py: 1,
                          px: 2,
                          fontWeight: 600,
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                          height: 40,
                          flex: 1,
                        }}
                      >
                        Use
                      </Button>
                    </Box>
                    

                  </Box>
                )}
                
                {/* Reps and Weight on one line */}
                <Box sx={{ display: 'flex', gap: 1, mb: sectionGap, alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <ScrollablePicker
                      items={repsOptions}
                      value={reps ? parseInt(reps) : ''}
                      onChange={(value) => setReps(value.toString())}
                      label="Reps"
                      getItemLabel={(item) => item.name}
                      getItemValue={(item) => item.id}
                      buttonHeight={40}
                      inputBackground={inputSurface}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      label="Weight (kg)"
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      fullWidth
                      size="small"
                      inputProps={{
                        min: 0,
                        step: 0.5,
                        inputMode: 'decimal',
                        pattern: '[0-9]*[.]?[0-9]*'
                      }}
                      error={!!weight && !isNumeric(weight)}
                      helperText={!!weight && !isNumeric(weight) ? 'Enter a valid number' : ''}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: 40,
                          minHeight: 40,
                          maxHeight: 40,
                          backgroundColor: inputSurface,
                          '& fieldset': {
                            borderColor: 'divider'
                          },
                          '&:hover fieldset': {
                            borderColor: 'primary.main'
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: 'primary.main'
                          }
                        },
                        '& .MuiInputLabel-root': {
                          color: 'text.primary',
                          fontSize: 13,
                          transform: 'translate(14px, 8px) scale(1)',
                          '&.Mui-focused': {
                            color: 'text.primary',
                            transform: 'translate(14px, -9px) scale(0.75)'
                          },
                          '&.MuiFormLabel-filled': {
                            transform: 'translate(14px, -9px) scale(0.75)'
                          }
                        },
                        '& .MuiInputBase-input': {
                          color: 'text.primary',
                          padding: '8px 14px',
                          height: '24px',
                          fontSize: 13
                        }
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                      <Button size="small" variant="outlined" onClick={() => adjustWeight(-2.5)} sx={{ flex: 1, py: 0.25, px: 0, fontSize: 11, minWidth: 0 }}>−2.5</Button>
                      <Button size="small" variant="outlined" onClick={() => adjustWeight(2.5)} sx={{ flex: 1, py: 0.25, px: 0, fontSize: 11, minWidth: 0 }}>+2.5</Button>
                    </Box>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleAddSet}
                      fullWidth
                      size="medium"
                      sx={{
                        py: 1,
                        fontWeight: 600,
                        fontSize: 13,
                        height: 40,
                      }}
                    >
                      Add
                    </Button>
                  </Box>
                </Box>
            </Box>
            
            {/* Sets Display */}
            {sets.length > 0 && (
              <Box sx={{ ...sectionSx, px: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={sectionTitleSx}>
                      Sets Added ({sets.length})
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => setSaveConfirmOpen(true)}
                      disabled={saving || sets.length === 0}
                      sx={{
                        py: 0.5,
                        px: 1.5,
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {saving ? 'Saving...' : 'Save All'}
                    </Button>
                  </Box>
                  <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 1 }} />
                  <Dialog open={saveConfirmOpen} onClose={() => setSaveConfirmOpen(false)}>
                    <DialogTitle sx={{ fontSize: 13 }}>Save workout?</DialogTitle>
                    <DialogContent>
                      <Typography sx={{ fontSize: 13 }}>
                        Are you sure you want to save your workout? This will log {sets.length} set{sets.length !== 1 ? 's' : ''} to your history.
                      </Typography>
                    </DialogContent>
                    <DialogActions>
                      <Button onClick={() => setSaveConfirmOpen(false)} sx={{ fontSize: 13 }}>Cancel</Button>
                      <Button onClick={handleSaveSets} variant="contained" disabled={saving} sx={{ fontSize: 13 }}>Yes, save</Button>
                    </DialogActions>
                  </Dialog>
                
                {/* Group sets by exercise */}
                {(() => {
                  const groupedSets = sets.reduce((acc, set) => {
                    if (!acc[set.exercise_name]) {
                      acc[set.exercise_name] = [];
                    }
                    acc[set.exercise_name].push(set);
                    return acc;
                  }, {});
                  
                  return Object.entries(groupedSets).map(([exerciseName, exerciseSets]) => {
                    const exerciseId = exerciseSets[0]?.exercise_id;
                    const range = exerciseId ? oneRmRanges[exerciseId] : null;
                    const current1RMs = exerciseSets.map((s) => calc1RM(s.weight, s.reps)).filter((v) => v > 0);
                    const hasBar = range && range.max > range.min && current1RMs.length > 0;
                    const barMin = range?.min ?? 0;
                    const barMax = range?.max ?? 1;
                    const barSpan = barMax - barMin || 1;
                    const barMaxExtended = barMax + 0.1 * barSpan;
                    const extendedSpan = barMaxExtended - barMin || 1;
                    return (
                    <Box key={exerciseName} sx={{ mb: smallGap }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'primary.main', fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, mr: 1 }}>
                          {exerciseName}
                        </Typography>
                        {hasBar && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: 180, flexShrink: 0, mr: 1.5 }}>
                            <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', width: 20, flexShrink: 0 }}>
                              {barMin.toFixed(0)}
                            </Typography>
                            <Box sx={{ flex: 1, minWidth: 80, display: 'flex', alignItems: 'center', position: 'relative' }}>
                              <Box sx={{ display: 'flex', width: '100%', position: 'relative' }}>
                                <Box sx={{ width: `${(barSpan / extendedSpan) * 100}%`, height: 14, borderRadius: 0, backgroundColor: 'divider', flexShrink: 0 }} />
                                <Box sx={{ width: `${(0.1 * barSpan / extendedSpan) * 100}%`, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5, flexShrink: 0 }}>
                                  <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Box sx={{ width: 6, height: 2, backgroundColor: 'divider' }} />
                                    <Box sx={{ width: 6, height: 2, backgroundColor: 'divider' }} />
                                  </Box>
                                  <Box sx={{ width: 2, height: 14, backgroundColor: 'divider', flexShrink: 0 }} />
                                </Box>
                              </Box>
                              <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', position: 'absolute', left: `${(barSpan / extendedSpan) * 100}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                                {barMax.toFixed(0)}
                              </Typography>
                              <Box sx={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, pointerEvents: 'none' }}>
                                {current1RMs.map((oneRm, idx) => {
                                  const pct = Math.max(0, Math.min(100, ((oneRm - barMin) / extendedSpan) * 100));
                                  return (
                                    <Box
                                      key={idx}
                                      sx={{
                                        position: 'absolute',
                                        left: `${pct}%`,
                                        top: '50%',
                                        transform: 'translate(-50%, -50%) rotate(45deg)',
                                        width: 8,
                                        height: 8,
                                        borderRadius: 0,
                                        backgroundColor: 'primary.main',
                                        border: '1px solid',
                                        borderColor: 'background.paper',
                                      }}
                                    />
                                  );
                                })}
                              </Box>
                            </Box>
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ 
                        display: 'table', 
                        width: '100%',
                        borderCollapse: 'collapse'
                      }}>
                        {exerciseSets.map((set, index) => (
                          <Box 
                            key={set.id} 
                            sx={{ 
                              display: 'table-row',
                              '&:hover': { 
                                bgcolor: 'background.paper'
                              },
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <Box sx={{
                              display: 'table-cell',
                              py: 0.25,
                              px: 1,
                              verticalAlign: 'middle'
                            }}>
                              <Typography
                                variant="body2"
                                color="text.primary"
                                sx={{
                                  fontSize: 13,
                                  fontWeight: 500
                                }}
                              >
                                {set.reps} reps @ {set.weight} kg
                              </Typography>
                            </Box>
                            <Box sx={{
                              display: 'table-cell',
                              py: 0.25,
                              px: 1,
                              verticalAlign: 'middle',
                              textAlign: 'right',
                              width: '40px'
                            }}>
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveSet(set.id)}
                                color="error"
                                sx={{ p: 0.5 }}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  );
                  });
                })()}
              </Box>
            )}

            {/* Strength Curve Chart */}
            {selectedExercise && (recentSets.length > 0 || currentExerciseSets.length > 0) && (
              <Box sx={{ ...sectionSx, px: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={sectionTitleSx}>Strength Curve</Typography>
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 16, height: 2, backgroundColor: '#00d4aa', borderRadius: 1 }} />
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>median</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#00d4aa' }} />
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>today</Typography>
                    </Box>
                  </Box>
                </Box>
                <StrengthCurveChart historicalSets={recentSets} currentSets={currentExerciseSets} />
              </Box>
            )}

            {/* Recent Best Sets */}
            {selectedExercise && (
              <Box sx={{ ...sectionSx, px: 0 }}>
                <Typography sx={sectionTitleSx}>
                  Last 10 workouts
                </Typography>

                {loadingData ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <Box>
                    {recentBestSets.length > 0 ? (
                      <Box sx={{ display: 'table', width: '100%', borderCollapse: 'collapse' }}>
                        {recentBestSets.map((set, index) => (
                          <Box
                            key={`${set.date}-${index}`}
                            onClick={() => { setWeight(set.weight.toString()); setReps(set.reps.toString()); haptic(); }}
                            sx={{
                              display: 'table-row',
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                              cursor: 'pointer',
                              '&:hover': { backgroundColor: 'background.paper' },
                            }}
                          >
                            <Box sx={{ display: 'table-cell', py: 1, px: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {set.date}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'table-cell', py: 1, px: 2, textAlign: 'right' }}>
                              <Typography variant="body2" color="text.secondary">
                                {set.weight} kg × {set.reps}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                        {bestSetPastYear && (
                          <Box
                            sx={{
                              display: 'table-row',
                              borderTop: '2px solid',
                              borderColor: 'divider',
                              backgroundColor: 'background.default',
                            }}
                          >
                            <Box sx={{ display: 'table-cell', py: 1, px: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {bestSetPastYear.label}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'table-cell', py: 1, px: 2, textAlign: 'right' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                {bestSetPastYear.weight} kg × {bestSetPastYear.reps}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 11 }}>
                        No recent sets found
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            )}
            </Box>
          </>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default WorkoutEntry; 