import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  MenuItem,
  Button,
  Select,
  FormControl,
  CircularProgress,
  Stack,
  useMediaQuery,
  useTheme,
  Snackbar,
  Alert as MuiAlert,
  ListSubheader,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';
import { API_BASE_URL } from '../App';


const defaultDays = ['Monday AM', 'Tuesday AM', 'Wednesday AM', 'Thursday AM', 'Friday AM', 'Saturday AM', 'Sunday AM'];



const initialProgram = {
  'Monday AM': [
    { exercise: 'Barbell bench press', sets: 3, targetReps: 8 },
    { exercise: 'Dumbbell shoulder press', sets: 3, targetReps: 8 },
    { exercise: 'Dips', sets: 3, targetReps: 8 },
    { exercise: 'Cable flies', sets: 3, targetReps: 12 },
    { exercise: 'EZ bar curl', sets: 3, targetReps: 10 },
    { exercise: 'Dumbbell lateral raise', sets: 3, targetReps: 12 },
  ],
  'Tuesday AM': [
    { exercise: 'Low bar squat', sets: 3, targetReps: 5 },
    { exercise: 'Hack squat', sets: 3, targetReps: 8 },
    { exercise: 'Leg press calf raise', sets: 3, targetReps: 15 },
    { exercise: 'Lunges', sets: 3, targetReps: 10 },
    { exercise: 'Leg extension', sets: 3, targetReps: 12 },
  ],
  'Wednesday AM': [
    { exercise: 'Pull-ups', sets: 3, targetReps: 8 },
    { exercise: 'Barbell row', sets: 3, targetReps: 8 },
    { exercise: 'Seated cable row', sets: 3, targetReps: 10 },
    { exercise: 'Stiff-legged DL', sets: 3, targetReps: 8 },
    { exercise: 'Hex bar shrugs', sets: 3, targetReps: 12 },
  ],
  'Thursday AM': [
    { exercise: 'Incline barbell bench press', sets: 3, targetReps: 8 },
    { exercise: 'Preacher curl', sets: 3, targetReps: 10 },
    { exercise: 'Overhead tricep extension', sets: 3, targetReps: 12 },
    { exercise: 'Incline dumbell curl', sets: 3, targetReps: 10 },
    { exercise: 'Dips', sets: 3, targetReps: 8 },
    { exercise: 'Hanging leg raise', sets: 3, targetReps: 12 },
  ],
  'Friday AM': [
    { exercise: 'High bar squat', sets: 3, targetReps: 5 },
    { exercise: 'Leg press', sets: 3, targetReps: 8 },
    { exercise: 'Leg press calf raise', sets: 3, targetReps: 15 },
    { exercise: 'Hanging leg raise', sets: 3, targetReps: 12 },
  ],
  'Saturday AM': [
    { exercise: 'Dumbbell shoulder press', sets: 3, targetReps: 8 },
    { exercise: 'Dumbbell lateral raise', sets: 3, targetReps: 12 },
    { exercise: 'Rear delt cable fly', sets: 3, targetReps: 12 },
    { exercise: 'Incline dumbell curl', sets: 3, targetReps: 10 },
  ],
  'Sunday AM': [
    { exercise: 'Deadlift', sets: 3, targetReps: 5 },
    { exercise: 'Pull-ups', sets: 3, targetReps: 8 },
    { exercise: 'Hex bar shrugs', sets: 3, targetReps: 12 },
    { exercise: 'Cable lat pulldown', sets: 3, targetReps: 10 },
    { exercise: 'Ab cable crunch', sets: 3, targetReps: 15 },
  ],
};

function getWeeklyVolumeAndFrequency(program, exerciseMap) {
  const volume = {};
  const freqDays = {};
  for (const day of defaultDays) {
    const musclesToday = new Set();
    for (const ex of (Array.isArray(program[day]) ? program[day] : [])) {
      if (!ex || !ex.exercise) continue;
      const muscle = exerciseMap[ex.exercise]?.muscle_group;
      if (!muscle) continue;
      volume[muscle] = (volume[muscle] || 0) + (parseInt(ex.sets) || 0);
      musclesToday.add(muscle);
    }
    for (const m of musclesToday) {
      freqDays[m] = (freqDays[m] || 0) + 1;
    }
  }
  return { volume, freqDays };
}

// Add this lookup table for optimal values
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

const WorkoutPlanner = () => {
  const [program, setProgram] = useState(initialProgram);
  const [exercises, setExercises] = useState([]);
  const [exerciseMap, setExerciseMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  
  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [editForm, setEditForm] = useState({
    exercise: '',
    sets: 3,
    targetReps: 8
  });


  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Load from backend on mount
  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/plan`);
        if (res.data) setProgram(res.data);
      } catch {}
    };
    fetchPlan();
  }, []);

  // Migrate any loaded plans with 'Wed AM' to 'Wednesday AM' and normalize days
  useEffect(() => {
    setProgram(prev => {
      let migrated = { ...prev };
      if (migrated['Wed AM']) {
        migrated['Wednesday AM'] = migrated['Wed AM'];
        delete migrated['Wed AM'];
      }
      // Ensure every day in defaultDays exists as an array
      defaultDays.forEach(day => {
        if (!Array.isArray(migrated[day])) {
          migrated[day] = [];
        }
      });
      return migrated;
    });
  }, []);

  useEffect(() => {
    const fetchExercises = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/exercises`);
        // Ensure exercises is always an array
        const exercisesData = Array.isArray(res.data) ? res.data : [];
        setExercises(exercisesData);
        const map = {};
        exercisesData.forEach(ex => { map[ex.name] = ex; });
        setExerciseMap(map);
      } catch (error) {
        console.error('Error loading exercises:', error);
        setExercises([]);
        setExerciseMap({});
      } finally {
        setLoading(false);
      }
    };
    fetchExercises();
  }, []);



  // Group exercises by muscle group for dropdown
  const groupedExercises = React.useMemo(() => {
    if (!Array.isArray(exercises) || exercises.length === 0) return [];
    const grouped = exercises.reduce((acc, exercise) => {
      const muscleGroup = exercise.muscle_group || 'Other';
      if (!acc[muscleGroup]) acc[muscleGroup] = [];
      acc[muscleGroup].push(exercise);
      return acc;
    }, {});
    // Sort muscle groups and exercises alphabetically
    return Object.keys(grouped)
      .sort()
      .map(muscleGroup => ({
        label: muscleGroup,
        items: grouped[muscleGroup].sort((a, b) => a.name.localeCompare(b.name))
      }));
  }, [exercises]);

  const handleChange = (day, idx, field, value) => {
    setProgram(prev => {
      const updated = { ...prev };
      updated[day] = updated[day].map((ex, i) =>
        i === idx ? { ...ex, [field]: value } : ex
      );
      return updated;
    });
  };

  const handleAddExercise = (day) => {
    setProgram(prev => ({
      ...prev,
      [day]: [...prev[day], { exercise: '', sets: 3, targetReps: 8 }],
    }));
  };

  const handleRemoveExercise = (day, idx) => {
    setProgram(prev => {
      const updated = { ...prev };
      updated[day] = updated[day].filter((_, i) => i !== idx);
      return updated;
    });
  };

  const handleEditExercise = (day, idx, exercise) => {
    setEditingExercise({ day, idx });
    setEditForm({
      exercise: exercise.exercise || '',
      sets: exercise.sets || 3,
      targetReps: exercise.targetReps || 8
    });
    setEditDialogOpen(true);
  };

  const handleSaveExercise = () => {
    if (!editForm.exercise.trim()) return;
    
    setProgram(prev => {
      const updated = { ...prev };
      if (editingExercise) {
        updated[editingExercise.day] = updated[editingExercise.day].map((ex, i) =>
          i === editingExercise.idx ? editForm : ex
        );
      }
      return updated;
    });
    
    setEditDialogOpen(false);
    setEditingExercise(null);
    setEditForm({ exercise: '', sets: 3, targetReps: 8 });
  };

  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setEditingExercise(null);
    setEditForm({ exercise: '', sets: 3, targetReps: 8 });
  };

  const handleSave = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/plan`, { plan_json: program });
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error saving plan:', error);
    }
  };



  const { volume: weeklyVolume, freqDays: weeklyFreq } = getWeeklyVolumeAndFrequency(program, exerciseMap);

  // Function to get fortnight frequency data
  const getFortnightFrequencyData = (program, exerciseMap) => {
    const muscleGroups = new Set();
    const fortnightData = {};
    
    // Get all unique muscle groups from the program
    for (const day of defaultDays) {
      for (const ex of (Array.isArray(program[day]) ? program[day] : [])) {
        if (!ex || !ex.exercise) continue;
        const muscle = exerciseMap[ex.exercise]?.muscle_group;
        if (muscle) {
          muscleGroups.add(muscle);
        }
      }
    }

    // Initialize fortnight data for each muscle group
    for (const muscle of muscleGroups) {
      fortnightData[muscle] = {};
      // Create 14 days (2 weeks)
      for (let week = 1; week <= 2; week++) {
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const dayName = defaultDays[dayIndex];
          const dayKey = `Week${week}_${dayName}`;
          fortnightData[muscle][dayKey] = false;
        }
      }
    }

    // Fill in the data based on the program
    for (let week = 1; week <= 2; week++) {
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayName = defaultDays[dayIndex];
        const dayKey = `Week${week}_${dayName}`;
        
        // Check if this day has exercises in the program
        const dayExercises = Array.isArray(program[dayName]) ? program[dayName] : [];
        for (const ex of dayExercises) {
          if (!ex || !ex.exercise) continue;
          const muscle = exerciseMap[ex.exercise]?.muscle_group;
          if (muscle) {
            fortnightData[muscle][dayKey] = true;
          }
        }
      }
    }

    return { muscleGroups: Array.from(muscleGroups).sort(), fortnightData };
  };

  const { muscleGroups, fortnightData } = getFortnightFrequencyData(program, exerciseMap);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" fontWeight={700}>
          Workout Planner
        </Typography>
        <Button variant="contained" onClick={handleSave}>
          Save Plan
        </Button>
      </Box>
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress size={isMobile ? 20 : 28} /></Box>
      ) : (
        <Stack spacing={2}>
          {defaultDays.map(day => {
        
            return (
              <Card key={day} sx={{ mb: 1 }}>
                <CardContent sx={{ p: 2 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.875rem' }}>{day}</Typography>
                    <Button 
                      startIcon={<AddIcon />} 
                      onClick={() => handleAddExercise(day)} 
                      variant="outlined"
                      size="small"
                      sx={{ 
                        py: 0.5, 
                        px: 1.5, 
                        fontSize: '0.75rem',
                        minHeight: '32px'
                      }}
                    >
                      Add Exercise
                    </Button>
                  </Box>
                  <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ 
                            fontSize: isMobile ? 11 : 14, 
                            fontWeight: 600, 
                            py: 1,
                            bgcolor: 'background.default',
                            borderBottom: '2px solid',
                            borderColor: 'divider',
                            pl: isMobile ? 1 : 2,
                            pr: isMobile ? 1 : 2
                          }}>
                            Exercise
                          </TableCell>
                          <TableCell align="center" sx={{ 
                            fontSize: isMobile ? 11 : 14, 
                            fontWeight: 600, 
                            py: 1,
                            bgcolor: 'background.default',
                            borderBottom: '2px solid',
                            borderColor: 'divider',
                            width: isMobile ? 40 : 50,
                            minWidth: isMobile ? 40 : 50,
                            maxWidth: isMobile ? 40 : 50
                          }}>
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(Array.isArray(program[day]) ? program[day] : []).map((ex, idx) => (
                          <TableRow key={idx} sx={{ '& .MuiTableCell-root': { py: 1 } }}>
                            <TableCell sx={{ 
                              fontSize: isMobile ? 11 : 14,
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                              pl: isMobile ? 1 : 2,
                              pr: isMobile ? 1 : 2,
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: 'background.default'
                              }
                            }}
                            onClick={() => handleEditExercise(day, idx, ex)}
                            >
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      fontWeight: 500,
                                      color: ex.exercise ? 'text.primary' : 'text.secondary',
                                      fontStyle: ex.exercise ? 'normal' : 'italic'
                                    }}
                                  >
                                    {ex.exercise || 'Click to add exercise'}
                                  </Typography>
                                  {ex.exercise && (
                                    <Typography 
                                      variant="body2" 
                                      color="text.secondary"
                                      sx={{ 
                                        fontWeight: 500,
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      • {ex.sets || 3} sets × {ex.targetReps || 8} reps
                                    </Typography>
                                  )}
                                </Box>
                                {exerciseMap[ex.exercise]?.muscle_group && (
                                  <Typography 
                                    variant="caption" 
                                    color="text.secondary" 
                                    sx={{ 
                                      fontSize: '0.7rem',
                                      fontWeight: 500,
                                      display: 'block'
                                    }}
                                  >
                                    {exerciseMap[ex.exercise].muscle_group}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="center" sx={{ 
                              fontSize: isMobile ? 11 : 14,
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                              width: isMobile ? 40 : 50,
                              minWidth: isMobile ? 40 : 50,
                              maxWidth: isMobile ? 40 : 50
                            }}>
                              <IconButton onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveExercise(day, idx);
                              }} size="small" color="error" sx={{ p: 0.5 }}>
                                <DeleteIcon sx={{ fontSize: '1rem' }} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
      <Card sx={{ mt: 4 }}>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
            Weekly Volume Analysis
          </Typography>
          <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ 
                    fontSize: isMobile ? 11 : 14, 
                    fontWeight: 600, 
                    py: 1,
                    bgcolor: 'background.default',
                    borderBottom: '2px solid',
                    borderColor: 'divider'
                  }}>
                    Muscle Group
                  </TableCell>
                  <TableCell align="right" sx={{ 
                    fontSize: isMobile ? 11 : 14, 
                    fontWeight: 600, 
                    py: 1,
                    bgcolor: 'background.default',
                    borderBottom: '2px solid',
                    borderColor: 'divider'
                  }}>
                    Sets/Week
                  </TableCell>
                  <TableCell align="right" sx={{ 
                    fontSize: isMobile ? 11 : 14, 
                    fontWeight: 600, 
                    py: 1,
                    bgcolor: 'background.default',
                    borderBottom: '2px solid',
                    borderColor: 'divider'
                  }}>
                    Frequency
                  </TableCell>
                  <TableCell align="right" sx={{ 
                    fontSize: isMobile ? 11 : 14, 
                    fontWeight: 600, 
                    py: 1,
                    bgcolor: 'success.light', 
                    color: 'success.contrastText',
                    borderBottom: '2px solid',
                    borderColor: 'divider'
                  }}>
                    Optimal Sets
                  </TableCell>
                  <TableCell align="right" sx={{ 
                    fontSize: isMobile ? 11 : 14, 
                    fontWeight: 600, 
                    py: 1,
                    bgcolor: 'success.light', 
                    color: 'success.contrastText',
                    borderBottom: '2px solid',
                    borderColor: 'divider'
                  }}>
                    Optimal Freq.
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.keys(weeklyVolume).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" color="text.secondary" sx={{ fontSize: isMobile ? 12 : 15, py: 2 }}>
                      No data
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.entries(weeklyVolume).map(([mg, sets]) => (
                    <TableRow key={mg} sx={{ '& .MuiTableCell-root': { py: 1 } }}>
                      <TableCell sx={{ 
                        fontSize: isMobile ? 11 : 14, 
                        fontWeight: 500,
                        borderBottom: '1px solid',
                        borderColor: 'divider'
                      }}>
                        {mg}
                      </TableCell>
                      <TableCell align="right" sx={{ 
                        fontSize: isMobile ? 11 : 14,
                        borderBottom: '1px solid',
                        borderColor: 'divider'
                      }}>
                        {sets}
                      </TableCell>
                      <TableCell align="right" sx={{ 
                        fontSize: isMobile ? 11 : 14,
                        borderBottom: '1px solid',
                        borderColor: 'divider'
                      }}>
                        {weeklyFreq[mg]}
                      </TableCell>
                      <TableCell align="right" sx={{ 
                        fontSize: isMobile ? 11 : 14,
                        bgcolor: 'success.50',
                        borderBottom: '1px solid',
                        borderColor: 'divider'
                      }}>
                        {OPTIMAL_RANGES[mg]?.sets || '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ 
                        fontSize: isMobile ? 11 : 14,
                        bgcolor: 'success.50',
                        borderBottom: '1px solid',
                        borderColor: 'divider'
                      }}>
                        {OPTIMAL_RANGES[mg]?.freq || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Fortnight Frequency Visual */}
      <Card sx={{ mt: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
            Muscle Group Frequency Over 2 Weeks
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <TableContainer component={Paper} sx={{ boxShadow: 'none', minWidth: isMobile ? 400 : 500 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: isMobile ? 11 : 14, fontWeight: 600, minWidth: 80 }}>Muscle Group</TableCell>
                                         {/* Week 1 Headers */}
                     {defaultDays.map((day, index) => (
                       <TableCell 
                         key={`week1_${index}`} 
                         align="center" 
                         sx={{ 
                           fontSize: isMobile ? 9 : 11, 
                           fontWeight: 600, 
                           bgcolor: 'background.default',
                           minWidth: isMobile ? 25 : 30,
                           maxWidth: isMobile ? 25 : 30,
                           width: isMobile ? 25 : 30,
                           borderRight: index === 6 ? '2px solid' : '1px solid',
                           borderColor: 'divider',
                           px: 0
                         }}
                       >
                         {day.charAt(0)}
                       </TableCell>
                     ))}
                     {/* Week 2 Headers */}
                     {defaultDays.map((day, index) => (
                       <TableCell 
                         key={`week2_${index}`} 
                         align="center" 
                         sx={{ 
                           fontSize: isMobile ? 9 : 11, 
                           fontWeight: 600, 
                           bgcolor: 'background.default',
                           minWidth: isMobile ? 25 : 30,
                           maxWidth: isMobile ? 25 : 30,
                           width: isMobile ? 25 : 30,
                           borderRight: index === 6 ? '2px solid' : '1px solid',
                           borderColor: 'divider',
                           px: 0
                         }}
                       >
                         {day.charAt(0)}
                       </TableCell>
                     ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {muscleGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} align="center" color="text.secondary" sx={{ fontSize: isMobile ? 12 : 15 }}>
                        No muscle groups found in program
                      </TableCell>
                    </TableRow>
                  ) : (
                    muscleGroups.map((muscleGroup) => (
                      <TableRow key={muscleGroup}>
                        <TableCell 
                          sx={{ 
                            fontSize: isMobile ? 11 : 14, 
                            fontWeight: 600,
                            borderRight: '2px solid',
                            borderColor: 'divider',
                            height: isMobile ? 35 : 40,
                            py: 1
                          }}
                        >
                          {muscleGroup}
                        </TableCell>
                        {/* Week 1 cells */}
                        {defaultDays.map((day, index) => {
                          const dayKey = `Week1_${day}`;
                          const isActive = fortnightData[muscleGroup]?.[dayKey] || false;
                          return (
                            <TableCell 
                              key={`week1_${muscleGroup}_${index}`}
                              align="center"
                              sx={{
                                fontSize: isMobile ? 9 : 11,
                                bgcolor: isActive ? 'primary.main' : 'background.default',
                                color: isActive ? 'primary.contrastText' : 'text.secondary',
                                fontWeight: isActive ? 600 : 400,
                                borderRight: index === 6 ? '2px solid' : '1px solid',
                                borderColor: 'divider',
                                borderBottom: '1px solid',
                                borderBottomColor: 'divider',
                                minWidth: isMobile ? 25 : 30,
                                maxWidth: isMobile ? 25 : 30,
                                width: isMobile ? 25 : 30,
                                height: isMobile ? 35 : 40,
                                px: 0,
                                py: 1,
                                '&:hover': {
                                  bgcolor: isActive ? 'primary.dark' : 'background.paper'
                                }
                              }}
                            >
                            </TableCell>
                          );
                        })}
                        {/* Week 2 cells */}
                        {defaultDays.map((day, index) => {
                          const dayKey = `Week2_${day}`;
                          const isActive = fortnightData[muscleGroup]?.[dayKey] || false;
                          return (
                            <TableCell 
                              key={`week2_${muscleGroup}_${index}`}
                              align="center"
                              sx={{
                                fontSize: isMobile ? 9 : 11,
                                bgcolor: isActive ? 'primary.main' : 'background.default',
                                color: isActive ? 'primary.contrastText' : 'text.secondary',
                                fontWeight: isActive ? 600 : 400,
                                borderRight: index === 6 ? '2px solid' : '1px solid',
                                borderColor: 'divider',
                                borderBottom: '1px solid',
                                borderBottomColor: 'divider',
                                minWidth: isMobile ? 25 : 30,
                                maxWidth: isMobile ? 25 : 30,
                                width: isMobile ? 25 : 30,
                                height: isMobile ? 35 : 40,
                                px: 0,
                                py: 1,
                                '&:hover': {
                                  bgcolor: isActive ? 'primary.dark' : 'background.paper'
                                }
                              }}
                            >
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Teal cells indicate when each muscle group is trained.
          </Typography>
        </CardContent>
      </Card>



      {/* Edit Exercise Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={handleCancelEdit}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            bgcolor: 'background.paper'
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 1,
          fontSize: '1.25rem',
          fontWeight: 600
        }}>
          Edit Exercise
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <TextField
              select
              label="Exercise"
              value={editForm.exercise}
              onChange={(e) => setEditForm(prev => ({ ...prev, exercise: e.target.value }))}
              size="small"
            >
              <MenuItem value=""><em>Select an exercise</em></MenuItem>
              {groupedExercises.map(group => [
                <ListSubheader key={group.label} sx={{ bgcolor: 'background.default', fontWeight: 600 }}>
                  {group.label}
                </ListSubheader>,
                ...group.items.map(exOpt => (
                  <MenuItem key={exOpt.id} value={exOpt.name} sx={{ pl: 3 }}>
                    {exOpt.name}
                  </MenuItem>
                ))
              ])}
            </TextField>
          </FormControl>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <FormControl fullWidth size="small" sx={{ flex: 1 }}>
              <TextField
                select
                label="Sets"
                value={editForm.sets}
                onChange={(e) => setEditForm(prev => ({ ...prev, sets: parseInt(e.target.value) || 3 }))}
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <MenuItem key={i + 1} value={i + 1}>
                    {i + 1}
                  </MenuItem>
                ))}
              </TextField>
            </FormControl>
            <FormControl fullWidth size="small" sx={{ flex: 1 }}>
              <TextField
                select
                label="Target Reps"
                value={editForm.targetReps}
                onChange={(e) => setEditForm(prev => ({ ...prev, targetReps: parseInt(e.target.value) || 8 }))}
              >
                {Array.from({ length: 30 }, (_, i) => (
                  <MenuItem key={i + 1} value={i + 1}>
                    {i + 1}
                  </MenuItem>
                ))}
              </TextField>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 2 }}>
          <Button 
            onClick={handleCancelEdit}
            variant="outlined"
            sx={{ 
              minWidth: '100px',
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveExercise}
            variant="contained"
            disabled={!editForm.exercise.trim()}
            sx={{ 
              minWidth: '100px',
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={2000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <MuiAlert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
          Plan saved!
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};

export default WorkoutPlanner; 