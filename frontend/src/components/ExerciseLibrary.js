import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import axios from 'axios';

const muscleGroups = [
  'Chest',
  'Back',
  'Quad',
  'Hamstring',
  'Glutes',
  'Calf',
  'Trapezius',
  'Anterior deltoid',
  'Lateral deltoid',
  'Posterior deltoid',
  'Triceps',
  'Bicep',
  'Abs',
];

const ExerciseLibrary = () => {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/exercises');
      // Ensure exercises is always an array
      setExercises(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error loading exercises:', err);
      setError('Failed to load exercises');
      setExercises([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newMuscle) {
      setAddError('Name and muscle group are required');
      return;
    }
    setAddError('');
    setAdding(true);
    try {
      await axios.post('/api/exercises', {
        name: newName.trim(),
        muscle_group: newMuscle,
      });
      setOpen(false);
      setNewName('');
      setNewMuscle('');
      fetchExercises();
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add exercise');
    } finally {
      setAdding(false);
    }
  };

  // Group exercises by muscle group, using muscleGroups order
  const grouped = exercises.reduce((acc, ex) => {
    if (!acc[ex.muscle_group]) acc[ex.muscle_group] = [];
    acc[ex.muscle_group].push(ex);
    return acc;
  }, {});
  // Use muscleGroups order, then any extra groups alphabetically
  const sortedGroups = [
    ...muscleGroups.filter(mg => grouped[mg]),
    ...Object.keys(grouped).filter(mg => !muscleGroups.includes(mg)).sort()
  ];

  return (
    <Box maxWidth={480} mx="auto" mt={4}>
      <Typography variant="h4" fontWeight={700} gutterBottom align="center">
        Exercise Library
      </Typography>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        sx={{ mb: 2, fontWeight: 600 }}
        onClick={() => setOpen(true)}
      >
        Add Exercise
      </Button>
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Card>
          <CardContent sx={{ p: 1 }}>
            {Array.isArray(sortedGroups) && sortedGroups.map((mg, idx) => (
              <Box key={mg} mb={1}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mt: idx !== 0 ? 2 : 0, mb: 0.5, color: 'primary.main', fontSize: 15 }}>
                  {mg}
                </Typography>
                <List dense disablePadding>
                  {Array.isArray(grouped[mg]) && grouped[mg]
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((ex, i) => (
                      <React.Fragment key={ex.id}>
                        <ListItem sx={{ py: 0.5 }}>
                          <ListItemText
                            primary={<Typography fontWeight={600} sx={{ fontSize: 14 }}>{ex.name}</Typography>}
                          />
                        </ListItem>
                        {i < grouped[mg].length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                </List>
              </Box>
            ))}
            {exercises.length === 0 && (
              <Typography color="text.secondary" align="center" py={2}>
                No exercises found
              </Typography>
            )}
          </CardContent>
        </Card>
      )}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Add New Exercise</DialogTitle>
        <DialogContent>
          <TextField
            label="Exercise Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            autoFocus
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Muscle Group</InputLabel>
            <Select
              value={newMuscle}
              onChange={e => setNewMuscle(e.target.value)}
              label="Muscle Group"
            >
              {Array.isArray(muscleGroups) && muscleGroups.map(mg => (
                <MenuItem key={mg} value={mg}>{mg}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {addError && <Alert severity="error" sx={{ mb: 1 }}>{addError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={adding}>Cancel</Button>
          <Button onClick={handleAdd} variant="contained" disabled={adding}>
            {adding ? 'Adding...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExerciseLibrary; 