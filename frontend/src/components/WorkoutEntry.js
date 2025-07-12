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
  CircularProgress,
  Paper,
  Slider,
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
  const containerHeight = itemHeight * visibleItems;

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
  const [suggestedWeights, setSuggestedWeights] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [sliderReps, setSliderReps] = useState(8); // Default to 8 reps for slider

  // Generate reps options (1-50)
  const repsOptions = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `${i + 1} reps` }));

  // Calculate weight for given reps using Brzycki formula
  const calculateWeightForReps = (targetReps, oneRepMax) => {
    if (!oneRepMax || targetReps <= 0) return 0;
    // Brzycki formula: weight = 1RM / (1.0278 - 0.0278 * reps)
    return oneRepMax / (1.0278 - 0.0278 * targetReps);
  };

  // Get estimated 1RM from suggested weights or recent sets
  const getEstimatedOneRepMax = () => {
    if (suggestedWeights && suggestedWeights.estimated_one_rep_max > 0) {
      return suggestedWeights.estimated_one_rep_max;
    }
    // If no suggested weights, try to calculate from recent sets
    if (recentSets.length > 0) {
      const latestSet = recentSets[0];
      return latestSet.one_rep_max || 0;
    }
    return 0;
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
                  <Box sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary" mb={1}>
                      Weight Calculator
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      Slide to adjust reps and see suggested weight
                    </Typography>
                    
                    <Box sx={{ px: 1 }}>
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
                            fontSize: '0.75rem',
                          },
                          '& .MuiSlider-valueLabel': {
                            fontSize: '0.75rem',
                          }
                        }}
                      />
                    </Box>
                    
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Typography variant="h6" fontWeight={600} color="primary.main">
                        {calculateWeightForReps(sliderReps, getEstimatedOneRepMax()).toFixed(1)} kg
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        for {sliderReps} reps
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          setReps(sliderReps.toString());
                          setWeight(calculateWeightForReps(sliderReps, getEstimatedOneRepMax()).toFixed(1));
                        }}
                        sx={{ mt: 1, fontSize: '0.75rem' }}
                      >
                        Use This Weight
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
      </Box>
    </LocalizationProvider>
  );
};

export default WorkoutEntry; 