import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  IconButton,
  Alert,
  Paper,
  Slider,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import axios from 'axios';

// Custom Scrollable Picker Component (Apple-style)
const ScrollablePicker = ({ 
  items, 
  value, 
  onChange, 
  label, 
  itemHeight = 40, 
  visibleItems = 5,
  getItemLabel = (item) => item.name || item.toString(),
  getItemValue = (item) => item.id || item,
  grouped = false,
  getGroupLabel = (group) => group.label || group.name
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [buttonRef, setButtonRef] = useState(null);
  const [menuRef, setMenuRef] = useState(null); // Add ref for menu
  const containerHeight = itemHeight * visibleItems;

  // Click-away logic
  useEffect(() => {
    if (!isOpen) return;
    function handleClickAway(event) {
      if (
        buttonRef &&
        !buttonRef.contains(event.target) &&
        menuRef &&
        !menuRef.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickAway);
    document.addEventListener('touchstart', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
      document.removeEventListener('touchstart', handleClickAway);
    };
  }, [isOpen, buttonRef, menuRef]);

  const handleItemClick = (item) => {
    onChange(getItemValue(item));
    setIsOpen(false);
  };

  const getSelectedItemLabel = () => {
    if (!value) return label;
    
    if (grouped) {
      // Find the item in grouped structure
      for (const group of items) {
        const found = group.items.find(item => getItemValue(item) === value);
        if (found) return getItemLabel(found);
      }
      return 'Select...';
    } else {
      const found = items.find(item => getItemValue(item) === value);
      return found ? getItemLabel(found) : 'Select...';
    }
  };

  const renderItems = () => {
    if (grouped) {
      return items.map((group, groupIndex) => (
        <React.Fragment key={group.label || group.name}>
          {/* Group Header */}
          <Box
            sx={{
              py: 1,
              px: 2,
              backgroundColor: 'grey.100',
              borderBottom: '1px solid',
              borderColor: 'grey.200',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: 'text.secondary',
            }}
          >
            {getGroupLabel(group)}
          </Box>
          {/* Group Items */}
          {group.items.map((item, index) => (
            <Box
              key={getItemValue(item)}
              onClick={() => handleItemClick(item)}
              sx={{
                py: 1.5,
                px: 3, // Indent items under group
                cursor: 'pointer',
                backgroundColor: getItemValue(item) === value ? 'primary.light' : 'transparent',
                color: getItemValue(item) === value ? 'primary.contrastText' : 'text.primary',
                '&:hover': {
                  backgroundColor: getItemValue(item) === value ? 'primary.light' : 'grey.100',
                },
                borderBottom: index < group.items.length - 1 ? '1px solid' : 'none',
                borderColor: 'grey.200',
              }}
            >
              <Typography variant="body2">
                {getItemLabel(item)}
              </Typography>
            </Box>
          ))}
        </React.Fragment>
      ));
    } else {
      return items.map((item, index) => (
        <Box
          key={getItemValue(item)}
          onClick={() => handleItemClick(item)}
          sx={{
            py: 1.5,
            px: 2,
            cursor: 'pointer',
            backgroundColor: getItemValue(item) === value ? 'primary.light' : 'transparent',
            color: getItemValue(item) === value ? 'primary.contrastText' : 'text.primary',
            '&:hover': {
              backgroundColor: getItemValue(item) === value ? 'primary.light' : 'grey.100',
            },
            borderBottom: index < items.length - 1 ? '1px solid' : 'none',
            borderColor: 'grey.200',
          }}
        >
          <Typography variant="body2">
            {getItemLabel(item)}
          </Typography>
        </Box>
      ));
    }
  };

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <Button
        ref={setButtonRef}
        variant="outlined"
        onClick={() => setIsOpen(!isOpen)}
        fullWidth
        sx={{ 
          justifyContent: 'space-between',
          textAlign: 'left',
          py: 1.5,
          px: 2,
          borderColor: 'grey.300',
          '&:hover': { borderColor: 'primary.main' },
          minWidth: 0,
          overflow: 'hidden'
        }}
      >
        <Typography
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {getSelectedItemLabel()}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, ml: 1 }}>
          ▼
        </Typography>
      </Button>
      
      {isOpen && buttonRef && ReactDOM.createPortal(
        <Paper
          ref={setMenuRef}
          elevation={8}
          sx={{
            position: 'fixed',
            zIndex: 9999, // Much higher z-index to ensure it appears above everything
            width: buttonRef.offsetWidth,
            maxHeight: containerHeight,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'grey.200',
            borderRadius: 1,
            // Position relative to the button
            top: buttonRef.getBoundingClientRect().bottom + 4,
            left: buttonRef.getBoundingClientRect().left,
            // Ensure it's not clipped by parent containers
            transform: 'translateZ(0)', // Force hardware acceleration
            willChange: 'transform',
          }}
        >
          <Box
            sx={{
              maxHeight: containerHeight,
              overflow: 'auto',
              '&::-webkit-scrollbar': { display: 'none' },
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            }}
          >
            {renderItems()}
          </Box>
        </Paper>,
        document.body
      )}
    </Box>
  );
};

const WorkoutEntry = () => {
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState([]);
  const [date, setDate] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [recentSets, setRecentSets] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sliderReps, setSliderReps] = useState(8); // Default to 8 reps for slider
  const [userPlan, setUserPlan] = useState(null);
  const [selectedPlannedWorkout, setSelectedPlannedWorkout] = useState('');

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

  // Group exercises by muscle group
  const groupedExercises = React.useMemo(() => {
    if (!Array.isArray(exercises) || exercises.length === 0) return [];
    
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
    fetchExercises();
    fetchUserPlan();
  }, []);

  const fetchExercises = async () => {
    try {
      const response = await axios.get('/api/exercises');
      // Ensure exercises is always an array
      setExercises(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading exercises:', error);
      setMessage('Error loading exercises');
      setExercises([]); // Set empty array on error
    } finally {
      // setLoading(false); // This line was removed
    }
  };

  const fetchUserPlan = async () => {
    try {
      const response = await axios.get('/api/plan');
      if (response.data) {
        // Migrate 'Wed AM' to 'Wednesday AM' if present
        let plan = { ...response.data };
        if (plan['Wed AM']) {
          plan['Wednesday AM'] = plan['Wed AM'];
          delete plan['Wed AM'];
        }
        setUserPlan(plan);
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
      const response = await axios.get(`/api/stats/recent-sets?exercise_id=${selectedExercise}&limit=5`);
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
      date: format(date, 'yyyy-MM-dd'),
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
    const savedSets = localStorage.getItem('workout_sets');
    if (savedSets) {
      try {
        setSets(JSON.parse(savedSets));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Save sets to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('workout_sets', JSON.stringify(sets));
  }, [sets]);

  const handleSaveSets = async () => {
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
        await axios.post('/api/workouts', {
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

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box maxWidth={480} mx="auto" mt={4}>
        {message && (
          <Alert severity={message.includes('Error') ? 'error' : 'success'} sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}
        <Card sx={{ mb: 3, p: 1.2, boxShadow: '0 2px 16px 0 rgba(34,34,59,0.04)', position: 'relative' }}> {/* More compact */}
          <CardContent sx={{ p: 1, overflow: 'visible' }}>
            <Grid container spacing={1} alignItems="center"> {/* More compact spacing */}
              
              {/* Planned Workout Selector */}
              {userPlan && Object.keys(userPlan).length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                        📋 Planned Workout
                      </Typography>
                    </Box>
                    
                    <ScrollablePicker
                      items={getPlannedWorkoutOptions()}
                      value={selectedPlannedWorkout}
                      onChange={setSelectedPlannedWorkout}
                      label="Select Planned Workout"
                      getItemLabel={(item) => item.name}
                      getItemValue={(item) => item.id}
                    />
                    
                    {/* Show exercises for selected workout */}
                    {selectedPlannedWorkout && (
                      <Box sx={{ mt: 1.5 }}>
                        {getSelectedWorkoutExercises().map((exercise, index) => {
                          // Find the exercise ID from the exercises list
                          const exerciseData = exercises.find(ex => ex.name === exercise.exercise);
                          return (
                            <Box 
                              key={index} 
                              onClick={() => {
                                if (exerciseData) {
                                  setSelectedExercise(exerciseData.id);
                                  // Also set the target reps if available
                                  if (exercise.targetReps) {
                                    setReps(exercise.targetReps.toString());
                                  }
                                }
                              }}
                              sx={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                py: 0.5,
                                px: 1,
                                borderRadius: 0.5,
                                bgcolor: exerciseData && selectedExercise === exerciseData.id ? 'primary.light' : 'white',
                                mb: 0.5,
                                border: '1px solid',
                                borderColor: exerciseData && selectedExercise === exerciseData.id ? 'primary.main' : 'grey.200',
                                '&:hover': { 
                                  bgcolor: exerciseData && selectedExercise === exerciseData.id ? 'primary.light' : 'grey.100',
                                  cursor: exerciseData ? 'pointer' : 'default'
                                },
                                minWidth: 0,
                                width: '100%',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <Typography 
                                variant="body2" 
                                color={exerciseData && selectedExercise === exerciseData.id ? 'primary.contrastText' : 'text.secondary'}
                                sx={{ 
                                  flex: 1,
                                  minWidth: 0,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {exercise.exercise}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                color={exerciseData && selectedExercise === exerciseData.id ? 'primary.contrastText' : 'text.secondary'}
                                sx={{ 
                                  flexShrink: 0,
                                  ml: 1,
                                  fontWeight: 600
                                }}
                              >
                                {exercise.sets} sets • {exercise.targetReps || '?'} reps
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                </Grid>
              )}
              
              <Grid item xs={12}>
                <DatePicker
                  label="Date"
                  value={date}
                  onChange={setDate}
                  maxDate={new Date()}
                  renderInput={(params) => <TextField {...params} fullWidth size="small" sx={{ mb: 0.5 }} />} // More compact
                />
              </Grid>
              <Grid item xs={12}>
                <ScrollablePicker
                  items={groupedExercises}
                  value={selectedExercise}
                  onChange={setSelectedExercise}
                  label="Select Exercise"
                  getItemLabel={(item) => item.name}
                  getItemValue={(item) => item.id}
                  grouped={true}
                  getGroupLabel={(group) => group.label}
                />
              </Grid>
              <Grid item xs={6}>
                <ScrollablePicker
                  items={repsOptions}
                  value={reps ? parseInt(reps) : ''}
                  onChange={(value) => setReps(value.toString())}
                  label="Select Reps"
                  getItemLabel={(item) => item.name}
                  getItemValue={(item) => item.id}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Weight (kg)"
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  fullWidth
                  size="small"
                  inputProps={{ min: 0, step: 0.5 }}
                  error={!!weight && !isNumeric(weight)}
                  helperText={!!weight && !isNumeric(weight) ? 'Enter a valid number' : ''}
                  sx={{ mb: 0.5 }}
                />
              </Grid>
              
              {/* Weight Calculator Slider */}
              {selectedExercise && getEstimatedOneRepMax() > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ mt: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                        Weight Calculator
                      </Typography>
                      <Typography variant="body2" color="primary.main" fontWeight={600}>
                        {roundToNearest2_5(calculateWeightForReps(sliderReps, getEstimatedOneRepMax()))} kg
                      </Typography>
                    </Box>
                    
                    <Box sx={{ px: 0.5 }}>
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
                            fontSize: '0.7rem',
                          },
                          '& .MuiSlider-valueLabel': {
                            fontSize: '0.7rem',
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
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <Typography variant="body2" color="text.secondary" fontSize="0.75rem">
                        {sliderReps} reps
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          setReps(sliderReps.toString());
                          setWeight(roundToNearest2_5(calculateWeightForReps(sliderReps, getEstimatedOneRepMax())).toString());
                        }}
                        sx={{ fontSize: '0.7rem', py: 0.5, px: 1 }}
                      >
                        Use
                      </Button>
                    </Box>
                  </Box>
                </Grid>
              )}
              {/* Notes input hidden for now */}
              {/*
              <Grid item xs={12}>
                <TextField
                  label="Notes (optional)"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  fullWidth
                  multiline
                  inputProps={{ maxLength: 100 }}
                  error={!!notesError}
                  helperText={notesError || `${notes.length}/100`}
                  size="small"
                  sx={{ mb: 0.5 }}
                />
              </Grid>
              */}
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={handleAddSet}
                  fullWidth
                  size="large"
                  sx={{ fontWeight: 600, fontSize: 17, py: 1 }}
                >
                  Add Set
                </Button>
              </Grid>
              
              {/* Compact Sets Display - Directly under Add Set button */}
              {sets.length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                        Sets Added ({sets.length})
                      </Typography>
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={handleSaveSets}
                        disabled={saving}
                        size="small"
                        sx={{ fontWeight: 600, fontSize: 12, py: 0.5, px: 1.5 }}
                      >
                        {saving ? 'Saving...' : 'Save All'}
                      </Button>
                    </Box>
                    
                    {/* Group sets by exercise */}
                    {(() => {
                      const groupedSets = sets.reduce((acc, set) => {
                        if (!acc[set.exercise_name]) {
                          acc[set.exercise_name] = [];
                        }
                        acc[set.exercise_name].push(set);
                        return acc;
                      }, {});
                      
                      return Object.entries(groupedSets).map(([exerciseName, exerciseSets]) => (
                        <Box key={exerciseName} sx={{ mb: 1.5 }}>
                          {/* Exercise name */}
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5, color: 'primary.main' }}>
                            {exerciseName}
                          </Typography>
                          {/* Sets for this exercise */}
                          <Box sx={{ pl: 1.5 }}>
                            {exerciseSets.map((set, index) => (
                              <Box 
                                key={set.id} 
                                sx={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center',
                                  py: 0.5,
                                  px: 1,
                                  borderRadius: 0.5,
                                  bgcolor: 'white',
                                  mb: 0.5,
                                  border: '1px solid',
                                  borderColor: 'grey.200',
                                  '&:hover': { bgcolor: 'grey.100' },
                                  minWidth: 0, // Prevent flex items from overflowing
                                  width: '100%'
                                }}
                              >
                                <Typography 
                                  variant="body2" 
                                  color="text.secondary"
                                  sx={{ 
                                    flex: 1,
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {set.reps} reps @ {set.weight} kg
                                </Typography>
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleRemoveSet(set.id)} 
                                  color="error"
                                  sx={{ p: 0.5, ml: 1, flexShrink: 0 }}
                                >
                                  <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      ));
                    })()}
                  </Box>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
        
        {/* Recent Sets Section */}
        {selectedExercise && (
          <Card sx={{ mb: 4, p: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>
                Recent Sets
              </Typography>
              
              {loadingData ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <Box>
                  {recentSets.length > 0 ? (
                    <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                      {recentSets.map((set, index) => (
                        <Box 
                          key={index} 
                          sx={{ 
                            p: 1, 
                            mb: 1, 
                            borderRadius: 1, 
                            bgcolor: 'grey.50',
                            border: '1px solid',
                            borderColor: 'grey.200'
                          }}
                        >
                          <Typography variant="body2" fontWeight={500}>
                            {(set.date_formatted || set.date)}: {set.weight}kg × {set.reps} reps
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Set {set.set_number} • 1RM: {set.one_rep_max.toFixed(1)}kg
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No recent sets found
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default WorkoutEntry; 