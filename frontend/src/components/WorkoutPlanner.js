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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';

const defaultDays = ['Monday AM', 'Tuesday AM', 'Wed AM', 'Thursday AM', 'Friday AM', 'Saturday AM', 'Sunday AM'];

const initialProgram = {
  'Monday AM': [
    { exercise: 'Barbell bench press', sets: 3 },
    { exercise: 'Dumbbell shoulder press', sets: 3 },
    { exercise: 'Dips', sets: 3 },
    { exercise: 'Cable flies', sets: 3 },
    { exercise: 'EZ bar curl', sets: 3 },
    { exercise: 'Dumbbell lateral raise', sets: 3 },
  ],
  'Tuesday AM': [
    { exercise: 'Low bar squat', sets: 3 },
    { exercise: 'Hack squat', sets: 3 },
    { exercise: 'Leg press calf raise', sets: 3 },
    { exercise: 'Lunges', sets: 3 },
    { exercise: 'Leg extension', sets: 3 },
  ],
  'Wed AM': [
    { exercise: 'Pull-ups', sets: 3 },
    { exercise: 'Barbell row', sets: 3 },
    { exercise: 'Seated cable row', sets: 3 },
    { exercise: 'Stiff-legged DL', sets: 3 },
    { exercise: 'Hex bar shrugs', sets: 3 },
  ],
  'Thursday AM': [
    { exercise: 'Incline barbell bench press', sets: 3 },
    { exercise: 'Preacher curl', sets: 3 },
    { exercise: 'Overhead tricep extension', sets: 3 },
    { exercise: 'Incline dumbell curl', sets: 3 },
    { exercise: 'Dips', sets: 3 },
    { exercise: 'Hanging leg raise', sets: 3 },
  ],
  'Friday AM': [
    { exercise: 'High bar squat', sets: 3 },
    { exercise: 'Leg press', sets: 3 },
    { exercise: 'Leg press calf raise', sets: 3 },
    { exercise: 'Hanging leg raise', sets: 3 },
  ],
  'Saturday AM': [
    { exercise: 'Dumbbell shoulder press', sets: 3 },
    { exercise: 'Dumbbell lateral raise', sets: 3 },
    { exercise: 'Rear delt cable fly', sets: 3 },
    { exercise: 'Incline dumbell curl', sets: 3 },
  ],
  'Sunday AM': [
    { exercise: 'Deadlift', sets: 3 },
    { exercise: 'Pull-ups', sets: 3 },
    { exercise: 'Hex bar shrugs', sets: 3 },
    { exercise: 'Cable lat pulldown', sets: 3 },
    { exercise: 'Ab cable crunch', sets: 3 },
  ],
};

function getWeeklyVolumeAndFrequency(program, exerciseMap) {
  const volume = {};
  const freqDays = {};
  for (const day of defaultDays) {
    const musclesToday = new Set();
    for (const ex of program[day]) {
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
const OPTIMAL_RANGES = {
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

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Load from backend on mount
  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const res = await axios.get('/api/plan');
        if (res.data) setProgram(res.data);
      } catch {}
    };
    fetchPlan();
  }, []);

  useEffect(() => {
    const fetchExercises = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/exercises');
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
      [day]: [...prev[day], { exercise: '', sets: 3 }],
    }));
  };

  const handleRemoveExercise = (day, idx) => {
    setProgram(prev => {
      const updated = { ...prev };
      updated[day] = updated[day].filter((_, i) => i !== idx);
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      await axios.post('/api/plan', { plan_json: program });
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error saving plan:', error);
    }
  };

  const { volume: weeklyVolume, freqDays: weeklyFreq } = getWeeklyVolumeAndFrequency(program, exerciseMap);

  return (
    <Box maxWidth={isMobile ? 400 : 700} mx="auto" mt={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h5" fontWeight={700} gutterBottom align="center" sx={{ fontSize: isMobile ? 20 : 28 }}>
          Workout Planner
        </Typography>
        <Button variant="contained" color="primary" onClick={handleSave} sx={{ fontSize: isMobile ? 12 : 16, minWidth: 0, px: isMobile ? 1 : 2 }}>
          Save
        </Button>
      </Box>
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress size={isMobile ? 20 : 28} /></Box>
      ) : (
        <Stack spacing={2}>
          {defaultDays.map(day => (
            <Card key={day} sx={{ mb: 1, p: isMobile ? 0.5 : 2 }}>
              <CardContent sx={{ p: isMobile ? 1 : 2 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: isMobile ? 15 : 20 }}>{day}</Typography>
                  <Button startIcon={<AddIcon sx={{ fontSize: isMobile ? 16 : 20 }} />} onClick={() => handleAddExercise(day)} size={isMobile ? 'small' : 'medium'} sx={{ fontSize: isMobile ? 12 : 16, minWidth: 0, px: isMobile ? 1 : 2 }}>
                    Add
                  </Button>
                </Box>
                <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
                  <Table size="small" sx={{ minWidth: 320 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontSize: isMobile ? 12 : 15, py: isMobile ? 0.5 : 1 }}>Exercise</TableCell>
                        <TableCell sx={{ fontSize: isMobile ? 12 : 15, py: isMobile ? 0.5 : 1 }}>Target Muscle</TableCell>
                        <TableCell sx={{ fontSize: isMobile ? 12 : 15, py: isMobile ? 0.5 : 1 }}>Sets</TableCell>
                        <TableCell align="center" sx={{ fontSize: isMobile ? 12 : 15, py: isMobile ? 0.5 : 1 }}>Remove</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {program[day].map((ex, idx) => (
                        <TableRow key={idx}>
                          <TableCell sx={{ minWidth: 120, fontSize: isMobile ? 12 : 15, py: isMobile ? 0.5 : 1 }}>
                            <FormControl fullWidth size="small" sx={{ fontSize: isMobile ? 12 : 15 }}>
                              <Select
                                value={ex.exercise}
                                onChange={e => handleChange(day, idx, 'exercise', e.target.value)}
                                displayEmpty
                                sx={{ fontSize: isMobile ? 12 : 15, py: isMobile ? 0.5 : 1 }}
                              >
                                <MenuItem value=""><em>None</em></MenuItem>
                                {Array.isArray(exercises) && exercises.map(exOpt => (
                                  <MenuItem key={exOpt.id} value={exOpt.name} sx={{ fontSize: isMobile ? 12 : 15 }}>{exOpt.name}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ fontSize: isMobile ? 12 : 15, py: isMobile ? 0.5 : 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? 12 : 15 }}>
                              {exerciseMap[ex.exercise]?.muscle_group || ''}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: isMobile ? 12 : 15, py: isMobile ? 0.5 : 1 }}>
                            <TextField
                              type="number"
                              value={ex.sets}
                              onChange={e => handleChange(day, idx, 'sets', e.target.value)}
                              size="small"
                              inputProps={{ min: 1, style: { width: isMobile ? 30 : 50, fontSize: isMobile ? 12 : 15, padding: isMobile ? 2 : 8 } }}
                              sx={{ fontSize: isMobile ? 12 : 15, width: isMobile ? 50 : 80, py: isMobile ? 0.5 : 1 }}
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ py: isMobile ? 0.5 : 1 }}>
                            <IconButton onClick={() => handleRemoveExercise(day, idx)} size={isMobile ? 'small' : 'medium'} color="error" sx={{ fontSize: isMobile ? 16 : 20 }}>
                              <DeleteIcon sx={{ fontSize: isMobile ? 16 : 20 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ fontSize: isMobile ? 15 : 20 }}>
            Estimated Weekly Sets per Muscle Group
          </Typography>
          <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: isMobile ? 12 : 15 }}>Muscle Group</TableCell>
                  <TableCell align="right" sx={{ fontSize: isMobile ? 12 : 15 }}>Sets/Week</TableCell>
                  <TableCell align="right" sx={{ fontSize: isMobile ? 12 : 15 }}>Frequency</TableCell>
                  <TableCell align="right" sx={{ fontSize: isMobile ? 12 : 15, bgcolor: '#e8f5e9', fontWeight: 700 }}>Optimal Sets</TableCell>
                  <TableCell align="right" sx={{ fontSize: isMobile ? 12 : 15, bgcolor: '#e8f5e9', fontWeight: 700 }}>Optimal Freq.</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.keys(weeklyVolume).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" color="text.secondary" sx={{ fontSize: isMobile ? 12 : 15 }}>No data</TableCell>
                  </TableRow>
                ) : (
                  Object.entries(weeklyVolume).map(([mg, sets]) => (
                    <TableRow key={mg}>
                      <TableCell sx={{ fontSize: isMobile ? 12 : 15 }}>{mg}</TableCell>
                      <TableCell align="right" sx={{ fontSize: isMobile ? 12 : 15 }}>{sets}</TableCell>
                      <TableCell align="right" sx={{ fontSize: isMobile ? 12 : 15 }}>{weeklyFreq[mg]}</TableCell>
                      <TableCell align="right" sx={{ fontSize: isMobile ? 12 : 15, bgcolor: '#f1f8e9' }}>{OPTIMAL_RANGES[mg]?.sets || '-'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: isMobile ? 12 : 15, bgcolor: '#f1f8e9' }}>{OPTIMAL_RANGES[mg]?.freq || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
      <Snackbar open={snackbarOpen} autoHideDuration={2000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <MuiAlert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
          Plan saved!
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};

export default WorkoutPlanner; 