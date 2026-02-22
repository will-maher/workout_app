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
import { API_BASE_URL } from '../App';

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
  
  // Edit exercise state
  const [editOpen, setEditOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [editName, setEditName] = useState('');
  const [editMuscle, setEditMuscle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState('');
  const [editing, setEditing] = useState(false);
  const sectionSx = {
    borderBottom: '1px solid',
    borderColor: 'divider',
    borderRadius: 0,
    boxShadow: 'none',
    bgcolor: 'transparent',
  };

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/api/exercises`);
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
      await axios.post(`${API_BASE_URL}/api/exercises`, {
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

  const handleEdit = (exercise) => {
    setEditingExercise(exercise);
    setEditName(exercise.name);
    setEditMuscle(exercise.muscle_group);
    setEditNotes(exercise.notes || '');
    setEditError('');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editMuscle) {
      setEditError('Name and muscle group are required');
      return;
    }
    setEditError('');
    setEditing(true);
    try {
      await axios.put(`${API_BASE_URL}/api/exercises/${editingExercise.id}`, {
        name: editName.trim(),
        muscle_group: editMuscle,
        notes: editNotes.trim(),
      });
      setEditOpen(false);
      setEditingExercise(null);
      setEditName('');
      setEditMuscle('');
      setEditNotes('');
      fetchExercises();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update exercise');
    } finally {
      setEditing(false);
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
    <Box maxWidth={480} mx="auto" mt={2} px={{ xs: 1.5, sm: 0 }} sx={{ '& .MuiTypography-root': { fontSize: 13 } }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4" fontWeight={700} sx={{ fontSize: 13 }}>
          Exercise Library
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          sx={{ fontWeight: 600 }}
          onClick={() => setOpen(true)}
        >
          Add Exercise
        </Button>
      </Box>
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Card sx={sectionSx}>
          <CardContent sx={{ p: 1 }}>
            {Array.isArray(sortedGroups) && sortedGroups.map((mg, idx) => (
              <Box key={mg} mb={1}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mt: idx !== 0 ? 2 : 0, mb: 0.5, color: 'primary.main', fontSize: 13 }}>
                  {mg}
                </Typography>
                <List dense disablePadding>
                  {Array.isArray(grouped[mg]) && grouped[mg]
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((ex, i) => (
                      <React.Fragment key={ex.id}>
                        <ListItem 
                          sx={{ 
                            py: 0.5,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'background.default' }
                          }}
                          onClick={() => handleEdit(ex)}
                        >
                          <ListItemText
                            primary={
                              <Box>
                                <Typography fontWeight={600} sx={{ fontSize: 13 }}>
                                  {ex.name}
                                </Typography>
                                {ex.notes && (
                                  <Typography 
                                    variant="caption" 
                                    color="text.secondary" 
                                    sx={{ 
                                      fontSize: 11,
                                      fontStyle: 'italic',
                                      display: 'block',
                                      mt: 0.5
                                    }}
                                  >
                                    {ex.notes}
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                        {i < grouped[mg].length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                </List>
              </Box>
            ))}
            {exercises.length === 0 && (
              <Typography color="text.secondary" align="center" py={2} sx={{ fontSize: 13 }}>
                No exercises found
              </Typography>
            )}
          </CardContent>
        </Card>
      )}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle sx={{ fontSize: 13 }}>Add New Exercise</DialogTitle>
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
      
      {/* Edit Exercise Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: 13 }}>Edit Exercise</DialogTitle>
        <DialogContent>
          <TextField
            label="Exercise Name"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            autoFocus
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Muscle Group</InputLabel>
            <Select
              value={editMuscle}
              onChange={e => setEditMuscle(e.target.value)}
              label="Muscle Group"
            >
              {Array.isArray(muscleGroups) && muscleGroups.map(mg => (
                <MenuItem key={mg} value={mg}>{mg}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Notes (optional)"
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="Add notes about variations, form cues, or specific instructions..."
            sx={{ mb: 2 }}
          />
          {editError && <Alert severity="error" sx={{ mb: 1 }}>{editError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={editing}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained" disabled={editing}>
            {editing ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExerciseLibrary; 