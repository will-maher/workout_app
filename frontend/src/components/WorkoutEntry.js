import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  IconButton,
  Slider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subMonths } from 'date-fns';
import axios from 'axios';
import { API_BASE_URL } from '../App';
import ScrollablePicker from './ScrollablePicker';

const WorkoutEntry = ({ onStatusMessage }) => {
  const setMessage = onStatusMessage ?? (() => {});
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [recentSets, setRecentSets] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sliderReps, setSliderReps] = useState(8); // Default to 8 reps for slider
  const [userPlan, setUserPlan] = useState(null);
  const [selectedPlannedWorkout, setSelectedPlannedWorkout] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [recentExerciseIds, setRecentExerciseIds] = useState([]);
  const [showPlannedExercises, setShowPlannedExercises] = useState(true);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [oneRmRanges, setOneRmRanges] = useState({});
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const inputSurface = 'background.paper';

  const smallTextSize = 11;
  const sectionGap = 2;
  const smallGap = 1;

  const sectionSx = {
    pb: sectionGap,
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

  // Get estimated 1RM using LOESS from performance data (heaviest set per workout)
  const getEstimatedOneRepMax = () => {
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
  };

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
      setNotes('');
      fetchRecentData();
    }
  }, [selectedExercise, fetchRecentData]);

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
      notes: notes.trim(),
    };
    setSets([...sets, newSet]);
    setMessage('');
    setNotes('');
    setReps(''); // Reset reps dropdown to blank
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>
              {/* Planned Workout Selector */}
              {userPlan && Object.keys(userPlan).length > 0 && (
                <Box sx={{ ...sectionSx, px: 0 }}>
                  <Typography sx={sectionTitleSx}>
                    Planned Workout
                  </Typography>
                    
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
                    <Box sx={{ mt: sectionGap }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setShowPlannedExercises((prev) => !prev)}
                        sx={{ mb: smallGap, fontSize: 11, py: 0.5, px: 1.5 }}
                      >
                        {showPlannedExercises ? 'Hide exercises' : 'Show exercises'}
                      </Button>
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
                                  py: 1, 
                                  px: 2,
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
                                  py: 1, 
                                  px: 2,
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
                      <Box sx={{ mt: sectionGap, p: sectionGap, borderTop: '1px solid', borderColor: 'divider' }}>
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
                
                {/* Weight Calculator Slider */}
                {selectedExercise && getEstimatedOneRepMax() > 0 && (
                  <Box sx={{ mb: sectionGap }}>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        fontSize: 11,
                        fontWeight: 500,
                        mb: 1
                      }}
                    >
                      Weight Calculator
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: smallGap }}>
                      <Typography variant="h6" color="primary.main" fontWeight={600} sx={{ fontSize: 13 }}>
                        {roundToNearest2_5(calculateWeightForReps(sliderReps, getEstimatedOneRepMax()))} kg • {sliderReps} reps
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 11 }}>
                        Est. 1RM: {roundToNearest2_5(getEstimatedOneRepMax())} kg
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
                          { value: 1, label: '1' },
                          { value: 5, label: '5' },
                          { value: 10, label: '10' },
                          { value: 15, label: '15' },
                          { value: 20, label: '20' }
                        ]}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value} reps`}
                        sx={{
                        '& .MuiSlider-markLabel': {
                          fontSize: 11,
                        },
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
                          setWeight(roundToNearest2_5(calculateWeightForReps(sliderReps, getEstimatedOneRepMax())).toString());
                        }}
                        sx={{ 
                          py: 1, 
                          px: 2, 
                          fontWeight: 600,
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                          height: 40,
                          mt: -0.5,
                          flex: 1
                        }}
                      >
                        Use
                      </Button>
                    </Box>
                    

                  </Box>
                )}
                
                {/* Reps and Weight on one line */}
                <Grid container sx={{ mb: sectionGap, alignItems: 'center' }}>
                  <Grid item xs={4} sx={{ pr: 1.5 }}>
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
                  </Grid>
                  <Grid item xs={4} sx={{ px: 1.5 }}>
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
                  </Grid>
                  <Grid item xs={4} sx={{ pl: 1.5 }}>
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
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Add Set
                    </Button>
                  </Grid>
                </Grid>
            </Box>
            
            {/* Sets Display */}
            {sets.length > 0 && (
              <Box sx={{ ...sectionSx, px: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={sectionTitleSx}>
                      Sets Added ({sets.length})
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={() => setSaveConfirmOpen(true)}
                      disabled={saving || sets.length === 0}
                      sx={{ 
                        py: 0.5,
                        px: 1.5,
                        fontWeight: 600,
                        fontSize: 13,
                        color: '#000000',
                        backgroundColor: '#7eb8da',
                        borderColor: '#7eb8da',
                        '&:hover': {
                          backgroundColor: '#8fc5e3',
                          borderColor: '#8fc5e3',
                        },
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
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
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
                              py: 1, 
                              px: 2,
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
                              py: 1, 
                              px: 2,
                              verticalAlign: 'middle',
                              textAlign: 'right',
                              width: '60px'
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

            {/* Recent Best Sets */}
            {selectedExercise && (
              <Box sx={{ ...sectionSx, px: 0 }}>
                <Typography sx={sectionTitleSx}>
                  Best Set From Last 10 Workouts
                </Typography>

                {loadingData ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <Box>
                    {recentBestSets.length > 0 ? (
                      <Box sx={{ display: 'table', width: '100%', borderCollapse: 'collapse' }}>
                        <Box sx={{ display: 'table-row', borderBottom: '1px solid', borderColor: 'divider' }}>
                          <Box sx={{ display: 'table-cell', py: 1, px: 2 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: 11 }}>
                              Workout
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'table-cell', py: 1, px: 2, textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: 11 }}>
                              Best Set
                            </Typography>
                          </Box>
                        </Box>
                        {recentBestSets.map((set, index) => (
                          <Box
                            key={`${set.date}-${index}`}
                            sx={{
                              display: 'table-row',
                              borderBottom: '1px solid',
                              borderColor: 'divider',
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