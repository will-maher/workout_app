import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  List,
  IconButton,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
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
      setError('Failed to load workout history');
      setWorkouts([]); // Set empty array on error
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
      <Box>
        <Typography variant="h4" gutterBottom>
          Workout History
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Search Section */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Search Workouts
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <DatePicker
                  label="Search by Date"
                  value={searchDate}
                  onChange={setSearchDate}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <Box display="flex" gap={2}>
                  <Button
                    variant="contained"
                    startIcon={<SearchIcon />}
                    onClick={handleSearch}
                    disabled={!searchDate}
                  >
                    Search
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleClearSearch}
                  >
                    Clear
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Workouts List */}
        {workouts.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="textSecondary" align="center" py={4}>
                {searchDate ? 'No workouts found for the selected date' : 'No workouts recorded yet'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <List>
            {Array.isArray(workouts) && workouts.map((workout) => (
              <Card key={workout.id} sx={{ mb: 2 }}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                      <Box>
                        <Typography variant="h6">
                          {format(parseISO(workout.date), 'MMM dd, yyyy')}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {workout.sets.length} sets • {getMuscleGroups(workout.sets)}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" color="textSecondary">
                          {formatWeight(calculateWorkoutVolume(workout.sets))} total volume
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewWorkout(workout.id);
                          }}
                        >
                          <ViewIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWorkoutToDelete(workout.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {Array.isArray(workout.sets) && workout.sets.map((set, index) => (
                        <Grid item xs={12} sm={6} md={4} key={set.id}>
                          <Card variant="outlined">
                            <CardContent sx={{ py: 1 }}>
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2">
                                  Set {index + 1}: {set.exercise_name}
                                </Typography>
                                <Chip
                                  label={set.muscle_group}
                                  size="small"
                                  sx={{
                                    backgroundColor: getMuscleGroupColor(set.muscle_group),
                                    color: 'white',
                                  }}
                                />
                              </Box>
                              <Typography variant="h6" color="primary">
                                {set.weight} lbs × {set.reps} reps
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                    {workout.notes && (
                      <Box mt={2}>
                        <Typography variant="body2" color="textSecondary">
                          <strong>Notes:</strong> {workout.notes}
                        </Typography>
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              </Card>
            ))}
          </List>
        )}

        {/* View Workout Dialog */}
        <Dialog
          open={viewDialogOpen}
          onClose={() => setViewDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Workout Details - {selectedWorkout && format(parseISO(selectedWorkout.date), 'MMM dd, yyyy')}
          </DialogTitle>
          <DialogContent>
            {selectedWorkout && (
              <Box>
                <TableContainer component={Paper}>
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
                          <TableCell align="right">{formatWeight(set.weight)}</TableCell>
                          <TableCell align="right">{set.reps}</TableCell>
                          <TableCell align="right">{formatWeight(set.weight * set.reps)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {selectedWorkout.notes && (
                  <Box mt={2}>
                    <Typography variant="h6">Notes:</Typography>
                    <Typography variant="body1">{selectedWorkout.notes}</Typography>
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
          <DialogTitle>Delete Workout</DialogTitle>
          <DialogContent>
            <Typography>
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

const formatWeight = (weight) => `${weight.toFixed(1)} lbs`;

export default WorkoutHistory; 