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
  Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import axios from 'axios';

const muscleGroups = [
  'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'other'
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
      setExercises(res.data);
    } catch (err) {
      setError('Failed to load exercises');
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

  // Group exercises by muscle group
  const grouped = exercises.reduce((acc, ex) => {
    if (!acc[ex.muscle_group]) acc[ex.muscle_group] = [];
    acc[ex.muscle_group].push(ex);
    return acc;
  }, {});
  const sortedGroups = Object.keys(grouped).sort();

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
            {sortedGroups.map((mg, idx) => (
              <Box key={mg} mb={1}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mt: idx !== 0 ? 2 : 0, mb: 0.5, color: 'primary.main', fontSize: 15 }}>
                  {mg}
                </Typography>
                <List dense disablePadding>
                  {grouped[mg].map((ex, i) => (
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
              {muscleGroups.map(mg => (
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