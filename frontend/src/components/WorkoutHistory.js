import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import axios from 'axios';
import { API_BASE_URL } from '../App';

const WorkoutHistory = () => {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState(null);
  const [searchDate, setSearchDate] = useState(null);
  const sectionSx = {
    borderBottom: '1px solid',
    borderColor: 'divider',
    borderRadius: 0,
    boxShadow: 'none',
    bgcolor: 'transparent',
  };

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async (date = null) => {
    try {
      setLoading(true);
      setError('');
      
      const params = date ? { date: format(date, 'yyyy-MM-dd') } : {};
      const response = await axios.get(`${API_BASE_URL}/api/workouts`, { params });
      // Ensure workouts is always an array
      setWorkouts(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching workouts:', err);
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setError('Failed to load workout history');
      }
      setWorkouts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewWorkout = async (workoutId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/workouts/${workoutId}`);
      setSelectedWorkout(response.data);
      setViewDialogOpen(true);
    } catch (err) {
      console.error('Error fetching workout details:', err);
      setError('Failed to load workout details');
    }
  };

  const handleDeleteWorkout = async () => {
    if (!workoutToDelete) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/workouts/${workoutToDelete}`);
      setWorkouts(workouts.filter(w => w.id !== workoutToDelete));
      setDeleteDialogOpen(false);
      setWorkoutToDelete(null);
    } catch (err) {
      console.error('Error deleting workout:', err);
      setError('Failed to delete workout');
    }
  };

  const handleSearch = () => {
    fetchWorkouts(searchDate);
  };

  const handleClearSearch = () => {
    setSearchDate(null);
    fetchWorkouts();
  };

  const getMuscleGroupColor = (muscleGroup) => {
    const colors = {
      chest: '#ff6b6b',
      back: '#4ecdc4',
      legs: '#45b7d1',
      shoulders: '#96ceb4',
      arms: '#feca57',
      core: '#ff9ff3',
    };
    return colors[muscleGroup] || '#95a5a6';
  };

  const calculateWorkoutVolume = (sets) => {
    if (!Array.isArray(sets)) return 0;
    return sets.reduce((total, set) => total + (set.weight * set.reps), 0);
  };

  const getMuscleGroups = (sets) => {
    if (!Array.isArray(sets)) return '';
    const groups = [...new Set(sets.map(set => set.muscle_group))];
    return groups.join(', ');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ maxWidth: 520, mx: 'auto', mt: 2, px: { xs: 1.5, sm: 0 }, '& .MuiTypography-root': { fontSize: 13 } }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 1, fontSize: 13 }}>
          Workout History
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 1 }} action={<Button color="inherit" size="small" onClick={() => fetchWorkouts(searchDate)}>Retry</Button>}>
            {error}
          </Alert>
        )}

        {/* Search Section */}
        <Box sx={{ ...sectionSx, py: 1, mb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { sm: 'center' } }}>
            <DatePicker
              label="Search by Date"
              value={searchDate}
              onChange={setSearchDate}
              slotProps={{ textField: { size: 'small', sx: { '& .MuiInputBase-root': { fontSize: 13 } } } }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" size="small" startIcon={<SearchIcon />} onClick={handleSearch} disabled={!searchDate} sx={{ fontSize: 13 }}>
                Search
              </Button>
              <Button variant="outlined" size="small" onClick={handleClearSearch} sx={{ fontSize: 13 }}>
                Clear
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Workouts List */}
        {workouts.length === 0 ? (
          <Box sx={{ ...sectionSx, py: 3 }}>
            <Typography color="text.secondary" align="center" sx={{ fontSize: 13 }}>
              {searchDate ? 'No workouts found for the selected date' : 'No workouts recorded yet'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Array.isArray(workouts) && workouts.map((workout) => (
              <Box key={workout.id} sx={{ ...sectionSx, pb: 1 }}>
                <Accordion sx={{ '&:before': { display: 'none' }, boxShadow: 'none', bgcolor: 'transparent' }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 20 }} />} sx={{ minHeight: 44, py: 0 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" pr={1}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: 13, color: 'primary.main' }}>
                          {format(parseISO(workout.date), 'MMM dd, yyyy')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 11 }}>
                          {workout.sets?.length || 0} sets • {getMuscleGroups(workout.sets || [])}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 11 }}>
                          {formatWeight(calculateWorkoutVolume(workout.sets || []))}
                        </Typography>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleViewWorkout(workout.id); }} sx={{ p: 0.5 }}>
                          <ViewIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setWorkoutToDelete(workout.id); setDeleteDialogOpen(true); }} sx={{ p: 0.5 }}>
                          <DeleteIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0, px: 2, pb: 1 }}>
                    <Box sx={{ display: 'table', width: '100%', borderCollapse: 'collapse' }}>
                      {Array.isArray(workout.sets) && workout.sets.map((set, index) => (
                        <Box key={set.id} sx={{ display: 'table-row' }}>
                          <Box sx={{ display: 'table-cell', py: 0.75, px: 0, borderBottom: '1px solid', borderColor: 'divider', verticalAlign: 'middle' }}>
                            <Typography variant="body2" sx={{ fontSize: 13 }}>
                              {set.exercise_name}: {set.weight} kg × {set.reps} reps
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'table-cell', py: 0.75, px: 0, borderBottom: '1px solid', borderColor: 'divider', verticalAlign: 'middle', width: 80, textAlign: 'right' }}>
                            <Chip label={set.muscle_group} size="small" sx={{ fontSize: 10, height: 20, backgroundColor: getMuscleGroupColor(set.muscle_group), color: 'white' }} />
                          </Box>
                        </Box>
                      ))}
                    </Box>
                    {workout.notes && (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 11, mt: 1 }}>
                        <strong>Notes:</strong> {workout.notes}
                      </Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
              </Box>
            ))}
          </Box>
        )}

        {/* View Workout Dialog */}
        <Dialog
          open={viewDialogOpen}
          onClose={() => setViewDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ fontSize: 13 }}>
            Workout Details - {selectedWorkout && format(parseISO(selectedWorkout.date), 'MMM dd, yyyy')}
          </DialogTitle>
          <DialogContent>
            {selectedWorkout && (
              <Box>
                <TableContainer component={Paper} sx={{ boxShadow: 'none', bgcolor: 'transparent', '& .MuiTableCell-root': { fontSize: 13 } }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Set</TableCell>
                        <TableCell>Exercise</TableCell>
                        <TableCell>Muscle Group</TableCell>
                        <TableCell align="right">Weight</TableCell>
                        <TableCell align="right">Reps</TableCell>
                        <TableCell align="right">Volume</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Array.isArray(selectedWorkout.sets) && selectedWorkout.sets.map((set, index) => (
                        <TableRow key={set.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{set.exercise_name}</TableCell>
                          <TableCell>
                            <Chip
                              label={set.muscle_group}
                              size="small"
                              sx={{
                                backgroundColor: getMuscleGroupColor(set.muscle_group),
                                color: 'white',
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">{set.weight} kg</TableCell>
                          <TableCell align="right">{set.reps}</TableCell>
                          <TableCell align="right">{formatWeight(set.weight * set.reps)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {selectedWorkout.notes && (
                  <Box mt={2}>
                    <Typography variant="h6" sx={{ fontSize: 13 }}>Notes:</Typography>
                    <Typography variant="body1" sx={{ fontSize: 13 }}>{selectedWorkout.notes}</Typography>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle sx={{ fontSize: 13 }}>Delete Workout</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: 13 }}>
              Are you sure you want to delete this workout? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDeleteWorkout} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

const formatWeight = (weight) => `${weight.toFixed(0)} kg`;

export default WorkoutHistory; 