import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import axios from 'axios';

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
  const [notesError, setNotesError] = useState('');
  const [recentSets, setRecentSets] = useState([]);
  const [suggestedWeights, setSuggestedWeights] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    try {
      const response = await axios.get('/api/exercises');
      setExercises(response.data);
    } catch (error) {
      setMessage('Error loading exercises');
    } finally {
      // setLoading(false); // This line was removed
    }
  };

  const fetchRecentData = useCallback(async () => {
    if (!selectedExercise) {
      setRecentSets([]);
      setSuggestedWeights(null);
      return;
    }
    try {
      setLoadingData(true);
      const [recentResponse, suggestedResponse] = await Promise.all([
        axios.get(`/api/stats/recent-sets?exercise_id=${selectedExercise}&limit=5`),
        axios.get(`/api/stats/suggested-weights?exercise_id=${selectedExercise}`)
      ]);
      setRecentSets(recentResponse.data);
      setSuggestedWeights(suggestedResponse.data);
    } catch (error) {
      console.error('Error fetching recent data:', error);
      setRecentSets([]);
      setSuggestedWeights(null);
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
    if (notes.length > 100) {
      setNotesError('Notes must be 100 characters or less');
      return;
    } else {
      setNotesError('');
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
  };

  const handleRemoveSet = (setId) => {
    setSets(sets.filter(set => set.id !== setId));
  };

  const handleSaveSets = async () => {
    if (sets.length === 0) {
      setMessage('Please add at least one set');
      return;
    }
    try {
      setSaving(true);
      // Save each set as a separate workout (or batch as needed)
      for (const set of sets) {
        await axios.post('/api/workouts', {
          date: set.date,
          sets: [
            {
              exercise_id: set.exercise_id,
              weight: set.weight,
              reps: set.reps,
              set_number: 1,
            },
          ],
        });
      }
      setMessage('Sets saved successfully!');
      setSets([]);
    } catch (error) {
      setMessage('Error saving sets');
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
        <Card sx={{ mb: 4, p: 2, boxShadow: '0 2px 16px 0 rgba(34,34,59,0.04)' }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12}>
                <DatePicker
                  label="Date"
                  value={date}
                  onChange={setDate}
                  maxDate={new Date()}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Exercise</InputLabel>
                  <Select
                    value={selectedExercise}
                    onChange={(e) => setSelectedExercise(e.target.value)}
                    label="Exercise"
                  >
                    {exercises.map((exercise) => (
                      <MenuItem key={exercise.id} value={exercise.id}>
                        {exercise.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Reps"
                  type="number"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  fullWidth
                  inputProps={{ min: 1 }}
                  error={!!reps && !isNumeric(reps)}
                  helperText={!!reps && !isNumeric(reps) ? 'Enter a valid number' : ''}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Weight (kg)"
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  fullWidth
                  inputProps={{ min: 0, step: 0.5 }}
                  error={!!weight && !isNumeric(weight)}
                  helperText={!!weight && !isNumeric(weight) ? 'Enter a valid number' : ''}
                />
              </Grid>
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
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={handleAddSet}
                  fullWidth
                  size="large"
                  sx={{ fontWeight: 600, fontSize: 18, py: 1.5 }}
                >
                  Add Set
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        
        {/* Recent Sets and Suggested Weights Table */}
        {selectedExercise && (
          <Card sx={{ mb: 4, p: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <TableChartIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Recent Sets & Suggested Weights
                </Typography>
              </Box>
              
              {loadingData ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {/* Recent Sets */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" fontWeight={600} mb={1}>
                      Recent Sets
                    </Typography>
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
                  </Grid>
                  
                  {/* Suggested Weights */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" fontWeight={600} mb={1}>
                      Suggested Weights
                    </Typography>
                    {suggestedWeights && suggestedWeights.estimated_one_rep_max > 0 ? (
                      <Box>
                        <Typography variant="body2" color="text.secondary" mb={1}>
                          Est. 1RM: {suggestedWeights.estimated_one_rep_max}kg
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mb={2}>
                          Target 1RM: {suggestedWeights.new_one_rep_max}kg
                        </Typography>
                        <Grid container spacing={1}>
                          {[
                            { reps: 3, weight: suggestedWeights.suggested_weights.reps_3 },
                            { reps: 5, weight: suggestedWeights.suggested_weights.reps_5 },
                            { reps: 8, weight: suggestedWeights.suggested_weights.reps_8 },
                            { reps: 12, weight: suggestedWeights.suggested_weights.reps_12 }
                          ].map((item) => (
                            <Grid item xs={6} key={item.reps}>
                              <Box 
                                sx={{ 
                                  p: 1, 
                                  borderRadius: 1, 
                                  bgcolor: 'primary.light',
                                  color: 'primary.contrastText',
                                  textAlign: 'center'
                                }}
                              >
                                <Typography variant="body2" fontWeight={600}>
                                  {item.weight}kg
                                </Typography>
                                <Typography variant="caption">
                                  {item.reps} reps
                                </Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No data available for suggestions
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        )}
        
        {sets.length > 0 && (
          <Card sx={{ mb: 4, p: 2 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>
                  Sets to Save
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleSaveSets}
                  disabled={saving}
                  sx={{ fontWeight: 600 }}
                >
                  {saving ? 'Saving...' : 'Save All'}
                </Button>
              </Box>
              <List>
                {sets.map((set, idx) => (
                  <React.Fragment key={set.id}>
                    <ListItem
                      secondaryAction={
                        <IconButton edge="end" onClick={() => handleRemoveSet(set.id)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      }
                      sx={{ borderRadius: 2, mb: 1, boxShadow: '0 1px 4px 0 rgba(34,34,59,0.04)' }}
                    >
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography fontWeight={600}>
                              {set.exercise_name}
                            </Typography>
                            <Chip label={set.muscle_group} size="small" />
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography color="text.secondary">
                              {set.reps} reps @ {set.weight} kg
                            </Typography>
                            {set.notes && (
                              <Typography color="text.secondary" fontStyle="italic">
                                {set.notes}
                              </Typography>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                    {idx < sets.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default WorkoutEntry; 