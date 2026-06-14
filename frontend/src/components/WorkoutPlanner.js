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
  FormControl,
  CircularProgress,
  Stack,
  useMediaQuery,
  useTheme,
  Snackbar,
  Alert as MuiAlert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ScrollablePicker from './ScrollablePicker';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';
import { API_BASE_URL } from '../App';


const defaultDays = ['Monday AM', 'Tuesday AM', 'Wednesday AM', 'Thursday AM', 'Friday AM', 'Saturday AM', 'Sunday AM'];



const initialProgram = {
  'Monday AM': [
    { exercise: 'Barbell bench press', sets: 3, targetReps: 8 },
    { exercise: 'Dumbell shoulder press', sets: 3, targetReps: 8 },
    { exercise: 'Dips', sets: 3, targetReps: 8 },
    { exercise: 'Cable flies', sets: 3, targetReps: 12 },
    { exercise: 'Ez bar curl', sets: 3, targetReps: 10 },
    { exercise: 'Dumbell lateral raise', sets: 3, targetReps: 12 },
  ],
  'Tuesday AM': [
    { exercise: 'Low bar squat', sets: 3, targetReps: 5 },
    { exercise: 'Hack squat', sets: 3, targetReps: 8 },
    { exercise: 'Leg press calf raise', sets: 3, targetReps: 15 },
    { exercise: 'Lunges', sets: 3, targetReps: 10 },
    { exercise: 'Leg extension', sets: 3, targetReps: 12 },
  ],
  'Wednesday AM': [
    { exercise: 'Pull ups', sets: 3, targetReps: 8 },
    { exercise: 'Barbell row', sets: 3, targetReps: 8 },
    { exercise: 'Seated cable row', sets: 3, targetReps: 10 },
    { exercise: 'Stiff legged deadlift', sets: 3, targetReps: 8 },
    { exercise: 'Hex bar shrugs', sets: 3, targetReps: 12 },
  ],
  'Thursday AM': [
    { exercise: 'Incline barbell bench press', sets: 3, targetReps: 8 },
    { exercise: 'Machine preacher', sets: 3, targetReps: 10 },
    { exercise: 'Overhead tricep extension rope', sets: 3, targetReps: 12 },
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
    { exercise: 'Dumbell shoulder press', sets: 3, targetReps: 8 },
    { exercise: 'Dumbell lateral raise', sets: 3, targetReps: 12 },
    { exercise: 'Rear delt cable fly', sets: 3, targetReps: 12 },
    { exercise: 'Incline dumbell curl', sets: 3, targetReps: 10 },
  ],
  'Sunday AM': [
    { exercise: 'Deadlift', sets: 3, targetReps: 5 },
    { exercise: 'Pull ups', sets: 3, targetReps: 8 },
    { exercise: 'Hex bar shrugs', sets: 3, targetReps: 12 },
    { exercise: 'Cable lat pulldown', sets: 3, targetReps: 10 },
    { exercise: 'Ab cable crunch', sets: 3, targetReps: 15 },
  ],
};

function getWeeklyVolumeAndFrequency(program, exerciseMap) {
  if (!program) return { volume: {}, freqDays: {} };
  
  const volume = {};
  const freqDays = {};
  for (const day of defaultDays) {
    const musclesToday = new Set();
    for (const ex of (program && Array.isArray(program[day]) ? program[day] : [])) {
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

const WorkoutPlanner = ({ user }) => {
  const [program, setProgram] = useState(null); // Start with null to indicate loading
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
  const sectionSx = {
    borderBottom: '1px solid',
    borderColor: 'divider',
    borderRadius: 0,
    boxShadow: 'none',
    bgcolor: 'transparent',
  };

  // Migrate legacy 'Wed AM' key to 'Wednesday AM' and ensure every day exists
  const normalizePlan = (plan) => {
    const normalized = { ...plan };
    if (normalized['Wed AM']) {
      normalized['Wednesday AM'] = normalized['Wed AM'];
      delete normalized['Wed AM'];
    }
    defaultDays.forEach(day => {
      if (!Array.isArray(normalized[day])) {
        normalized[day] = [];
      }
    });
    return normalized;
  };

  // Load from backend when user is available
  useEffect(() => {
    if (!user) return;

    const fetchPlan = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/plan`);

        if (res.data && Object.keys(res.data).length > 0) {
          setProgram(normalizePlan(res.data));
        } else {
          setProgram(initialProgram);
        }
      } catch (error) {
        console.error('Error loading plan:', error);
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          // Authentication error - fall back to locally cached plan if present
          const cachedPlan = localStorage.getItem('cachedPlan');
          if (cachedPlan) {
            try {
              setProgram(normalizePlan(JSON.parse(cachedPlan)));
            } catch {
              setProgram(initialProgram);
            }
          } else {
            setProgram(initialProgram);
          }
        } else {
          // No plan yet (404) or other error - start from the initial program
          setProgram(initialProgram);
        }
      }
    };
    fetchPlan();
  }, [user]);

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

      // Cache the plan locally for offline/error recovery
      localStorage.setItem('cachedPlan', JSON.stringify(program));

      // Refresh from the database to confirm what was persisted
      const refreshRes = await axios.get(`${API_BASE_URL}/api/plan`);
      if (refreshRes.data && Object.keys(refreshRes.data).length > 0) {
        setProgram(normalizePlan(refreshRes.data));
        localStorage.setItem('cachedPlan', JSON.stringify(refreshRes.data));
      }

      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error saving plan:', error);
    }
  };



  const { volume: weeklyVolume, freqDays: weeklyFreq } = program ? getWeeklyVolumeAndFrequency(program, exerciseMap) : { volume: {}, freqDays: {} };

  // Function to get fortnight frequency data
  const getFortnightFrequencyData = (program, exerciseMap) => {
    if (!program) return { muscleGroups: [], fortnightData: {} };
    
    const muscleGroups = new Set();
    const fortnightData = {};
    
    // Get all unique muscle groups from the program
    for (const day of defaultDays) {
      for (const ex of (program && Array.isArray(program[day]) ? program[day] : [])) {
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
        const dayExercises = program && Array.isArray(program[dayName]) ? program[dayName] : [];
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

  const { muscleGroups, fortnightData } = program ? getFortnightFrequencyData(program, exerciseMap) : { muscleGroups: [], fortnightData: {} };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 2, px: { xs: 1.5, sm: 0 }, '& .MuiTypography-root': { fontSize: 13 } }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" fontWeight={700} sx={{ fontSize: 13 }}>
          Workout Planner
        </Typography>
        <Button variant="contained" onClick={handleSave}>
          Save Plan
        </Button>
      </Box>
      {loading || !program ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress size={isMobile ? 20 : 28} /></Box>
      ) : (
        <Stack spacing={2}>
          {defaultDays.map(day => {
        
            return (
              <Card key={day} sx={{ ...sectionSx, mb: 1 }}>
                <CardContent sx={{ p: 2 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: 13 }}>{day}</Typography>
                    <Button 
                      startIcon={<AddIcon />} 
                      onClick={() => handleAddExercise(day)} 
                      variant="outlined"
                      size="small"
                      sx={{ 
                        py: 0.5, 
                        px: 1.5, 
                        fontSize: 13,
                        minHeight: '32px'
                      }}
                    >
                      Add Exercise
                    </Button>
                  </Box>
                  <Box>
                    {(program && Array.isArray(program[day]) ? program[day] : []).length === 0 && (
                      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontStyle: 'italic', py: 1 }}>
                        Rest day — no exercises planned
                      </Typography>
                    )}
                    {(program && Array.isArray(program[day]) ? program[day] : []).map((ex, idx) => (
                      <Box
                        key={idx}
                        onClick={() => handleEditExercise(day, idx, ex)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          py: 1,
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          cursor: 'pointer',
                          '&:last-of-type': { borderBottom: 'none' },
                          '&:active': { backgroundColor: 'rgba(255,255,255,0.03)' },
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            sx={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: ex.exercise ? 'text.primary' : 'text.secondary',
                              fontStyle: ex.exercise ? 'normal' : 'italic',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {ex.exercise || 'Tap to choose exercise'}
                          </Typography>
                          {exerciseMap[ex.exercise]?.muscle_group && (
                            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                              {exerciseMap[ex.exercise].muscle_group}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                          {ex.exercise && (
                            <Box
                              sx={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: 'primary.main',
                                border: '1px solid',
                                borderColor: 'rgba(0, 212, 170, 0.35)',
                                borderRadius: 10,
                                px: 1,
                                py: 0.25,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {ex.sets || 3} × {ex.targetReps || 8}
                            </Box>
                          )}
                          <IconButton onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveExercise(day, idx);
                          }} size="small" color="error" sx={{ p: 0.5, opacity: 0.7 }}>
                            <DeleteIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
      <Card sx={{ ...sectionSx, mt: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 2, fontSize: 13 }}>
            Weekly Volume Analysis
          </Typography>
          {Object.keys(weeklyVolume).length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'center', py: 2 }}>
              No data
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {Object.entries(weeklyVolume)
                .sort((a, b) => b[1] - a[1])
                .map(([mg, sets]) => {
                  const optimal = OPTIMAL_RANGES[mg];
                  let minOpt = 0, maxOpt = 0;
                  const match = optimal?.sets?.match(/(\d+)[^\d]+(\d+)/);
                  if (match) {
                    minOpt = parseInt(match[1], 10);
                    maxOpt = parseInt(match[2], 10);
                  }
                  const scaleMax = Math.max(sets, maxOpt) * 1.15 || 1;
                  const inRange = !maxOpt || (sets >= minOpt && sets <= maxOpt);
                  const barColor = inRange ? 'primary.main' : sets > maxOpt ? '#F09595' : '#FAC775';
                  return (
                    <Box key={mg}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{mg}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                          {sets} sets{maxOpt ? ` / ${minOpt}–${maxOpt}` : ''} · {weeklyFreq[mg]}×wk{optimal?.freq ? ` / ${optimal.freq}` : ''}
                        </Typography>
                      </Box>
                      <Box sx={{ position: 'relative', height: 14, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                        {maxOpt > 0 && (
                          <Box
                            sx={{
                              position: 'absolute',
                              left: `${(minOpt / scaleMax) * 100}%`,
                              width: `${((maxOpt - minOpt) / scaleMax) * 100}%`,
                              top: 0,
                              bottom: 0,
                              backgroundColor: 'rgba(0, 212, 170, 0.14)',
                            }}
                          />
                        )}
                        <Box
                          sx={{
                            position: 'absolute',
                            left: 0,
                            top: 4,
                            height: 6,
                            width: `${(sets / scaleMax) * 100}%`,
                            borderRadius: 3,
                            backgroundColor: barColor,
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.5 }}>
                Shaded band = optimal weekly sets · amber = below range, red = above range
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Fortnight Frequency Visual */}
      <Card sx={{ ...sectionSx, mt: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
            Muscle Group Frequency Over 2 Weeks
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <TableContainer component={Paper} sx={{ boxShadow: 'none', bgcolor: 'transparent', minWidth: isMobile ? 400 : 500 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: isMobile ? 11 : 13, fontWeight: 600, minWidth: 80 }}>Muscle Group</TableCell>
                                         {/* Week 1 Headers */}
                     {defaultDays.map((day, index) => (
                       <TableCell 
                         key={`week1_${index}`} 
                         align="center" 
                         sx={{ 
                           fontSize: isMobile ? 11 : 13, 
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
                           fontSize: isMobile ? 11 : 13, 
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
                      <TableCell colSpan={15} align="center" color="text.secondary" sx={{ fontSize: isMobile ? 12 : 13 }}>
                        No muscle groups found in program
                      </TableCell>
                    </TableRow>
                  ) : (
                    muscleGroups.map((muscleGroup) => (
                      <TableRow key={muscleGroup}>
                        <TableCell 
                          sx={{ 
                            fontSize: isMobile ? 11 : 13, 
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
                                fontSize: isMobile ? 11 : 13,
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
                                fontSize: isMobile ? 11 : 13,
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
          fontSize: 13,
          fontWeight: 600
        }}>
          Edit Exercise
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ mb: 3 }}>
            <ScrollablePicker
              items={groupedExercises}
              value={editForm.exercise}
              onChange={(val) => setEditForm(prev => ({ ...prev, exercise: val }))}
              label="Select exercise..."
              grouped={true}
              getItemLabel={(item) => item.name}
              getItemValue={(item) => item.name}
              searchEnabled={true}
              searchPlaceholder="Search exercises..."
              buttonHeight={44}
            />
          </Box>
          
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