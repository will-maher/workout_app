import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
  Chip,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addWeeks, differenceInCalendarDays, parseISO } from 'date-fns';
import axios from 'axios';
import { API_BASE_URL } from '../App';
import ScrollablePicker from './ScrollablePicker';

const Goals = () => {
  const [goals, setGoals] = useState(() => {
    try {
      const cached = localStorage.getItem('goals_cache');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState('');

  const [formExercise, setFormExercise] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formDate, setFormDate] = useState(addWeeks(new Date(), 12));
  const [currentOneRm, setCurrentOneRm] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/goals`);
      const data = Array.isArray(res.data) ? res.data : [];
      setGoals(data);
      setFetchError(false);
      try { localStorage.setItem('goals_cache', JSON.stringify(data)); } catch {}
    } catch (err) {
      console.error('Error fetching goals:', err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
    axios.get(`${API_BASE_URL}/api/exercises`)
      .then(res => setExercises(Array.isArray(res.data) ? res.data : []))
      .catch(() => setExercises([]));
  }, [fetchGoals]);

  // Current estimated 1RM for the exercise picked in the create dialog
  useEffect(() => {
    if (!formExercise) {
      setCurrentOneRm(null);
      return;
    }
    let cancelled = false;
    axios.get(`${API_BASE_URL}/api/stats/suggested-weights?exercise_id=${formExercise}`)
      .then(res => {
        if (!cancelled) setCurrentOneRm(res.data?.estimated_one_rep_max || 0);
      })
      .catch(() => {
        if (!cancelled) setCurrentOneRm(0);
      });
    return () => { cancelled = true; };
  }, [formExercise]);

  const groupedExercises = useMemo(() => {
    if (!exercises.length) return [];
    const grouped = exercises.reduce((acc, ex) => {
      const mg = ex.muscle_group || 'Other';
      if (!acc[mg]) acc[mg] = [];
      acc[mg].push(ex);
      return acc;
    }, {});
    return Object.keys(grouped).sort().map(mg => ({
      label: mg,
      items: grouped[mg].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [exercises]);

  const weeklyRate = useMemo(() => {
    const target = parseFloat(formTarget);
    if (!currentOneRm || !target || target <= currentOneRm || !formDate) return null;
    const days = differenceInCalendarDays(formDate, new Date());
    if (days <= 0) return null;
    return ((target - currentOneRm) / days) * 7;
  }, [formTarget, currentOneRm, formDate]);

  const rateLabel = useMemo(() => {
    if (weeklyRate == null) return null;
    if (weeklyRate <= 0.75) return { text: 'steady pace', color: '#5DCAA5' };
    if (weeklyRate <= 1.5) return { text: 'realistic', color: '#5DCAA5' };
    if (weeklyRate <= 2.5) return { text: 'ambitious', color: '#FAC775' };
    return { text: 'very aggressive', color: '#F09595' };
  }, [weeklyRate]);

  const resetForm = () => {
    setFormExercise('');
    setFormTarget('');
    setFormDate(addWeeks(new Date(), 12));
    setCurrentOneRm(null);
    setError('');
  };

  const handleCreate = async () => {
    if (!formExercise || !formTarget || !formDate) return;
    try {
      setSaving(true);
      setError('');
      await axios.post(`${API_BASE_URL}/api/goals`, {
        exercise_id: parseInt(formExercise, 10),
        target_one_rm: parseFloat(formTarget),
        target_date: format(formDate, 'yyyy-MM-dd'),
      });
      await fetchGoals();
      setCreateOpen(false);
      resetForm();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create goal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/goals/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchGoals();
    } catch (err) {
      console.error('Error deleting goal:', err);
      setDeleteTarget(null);
    }
  };

  const goalSubtitle = (goal) => {
    const weeks = Math.max(1, Math.round(differenceInCalendarDays(parseISO(goal.target_date), parseISO(goal.start_date)) / 7));
    const rate = (goal.target_one_rm - goal.start_one_rm) / weeks;
    return `${goal.start_one_rm} kg → ${goal.target_one_rm} kg by ${format(parseISO(goal.target_date), 'd MMM')} · ${weeks} wk · +${rate.toFixed(1)} kg/wk`;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ maxWidth: 520, mx: 'auto', mt: 2, px: { xs: 1.5, sm: 0 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
            Goals
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => { resetForm(); setCreateOpen(true); }}
            sx={{ fontSize: 13, py: 0.5, px: 1.5 }}
          >
            New goal
          </Button>
        </Box>

        {loading && goals.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Skeleton variant="rounded" height={96} />
            <Skeleton variant="rounded" height={96} />
          </Box>
        ) : goals.length === 0 && fetchError ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Typography color="text.secondary" sx={{ fontSize: 13, mb: 1.5 }}>
              Couldn't load goals
            </Typography>
            <Button size="small" variant="outlined" onClick={fetchGoals} sx={{ fontSize: 13 }}>
              Retry
            </Button>
          </Box>
        ) : goals.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Typography color="text.secondary" sx={{ fontSize: 13, mb: 1 }}>
              No goals yet
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 11 }}>
              Set a target 1RM and a date, and your progress will show here, on the Performance chart, and while you log sets.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {goals.map(goal => {
              const expectedPct = goal.target_one_rm === goal.start_one_rm ? 100 :
                Math.min(100, Math.max(0, ((goal.expected_one_rm - goal.start_one_rm) / (goal.target_one_rm - goal.start_one_rm)) * 100));
              return (
                <Box
                  key={goal.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    p: 2,
                    backgroundColor: 'background.paper',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                      {goal.exercise_name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip
                        label={goal.achieved ? 'achieved' : goal.on_track ? 'on track' : 'behind'}
                        size="small"
                        sx={{
                          fontSize: 10,
                          height: 20,
                          fontWeight: 600,
                          color: '#04342C',
                          backgroundColor: goal.achieved ? '#9FE1CB' : goal.on_track ? '#5DCAA5' : '#FAC775',
                        }}
                      />
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(goal)} sx={{ p: 0.5 }}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography color="text.secondary" sx={{ fontSize: 11, mb: 1.5 }}>
                    {goalSubtitle(goal)}
                  </Typography>
                  <Box sx={{ position: 'relative', height: 8, borderRadius: 4, backgroundColor: 'divider', mb: 0.75 }}>
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${goal.progress * 100}%`,
                        borderRadius: 4,
                        backgroundColor: 'primary.main',
                        transition: 'width 0.4s ease',
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${expectedPct}%`,
                        top: -3,
                        width: 2,
                        height: 14,
                        backgroundColor: 'text.secondary',
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      now: <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{goal.current_one_rm} kg</Box>
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      plan: {goal.expected_one_rm} kg
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      target: {goal.target_one_rm} kg
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontSize: 13, fontWeight: 600 }}>New goal</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <ScrollablePicker
                items={groupedExercises}
                value={formExercise}
                onChange={setFormExercise}
                label="Exercise"
                grouped
                getGroupLabel={(g) => g.label}
                searchEnabled
                searchPlaceholder="Search exercises..."
              />
              {formExercise && currentOneRm !== null && (
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {currentOneRm > 0
                    ? <>Current estimated 1RM: <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{Math.round(currentOneRm * 10) / 10} kg</Box></>
                    : 'No logged sets yet for this exercise — log some first so a starting point can be estimated.'}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Target 1RM (kg)"
                  type="number"
                  size="small"
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                  inputProps={{ min: 0, step: 0.5, inputMode: 'decimal' }}
                  sx={{ flex: 1 }}
                />
                <DatePicker
                  label="Target date"
                  value={formDate}
                  onChange={setFormDate}
                  disablePast
                  slotProps={{ textField: { size: 'small', sx: { flex: 1 } } }}
                />
              </Box>
              {rateLabel && (
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  Requires <Box component="span" sx={{ color: rateLabel.color, fontWeight: 600 }}>+{weeklyRate.toFixed(1)} kg/week</Box> — {rateLabel.text}
                </Typography>
              )}
              {error && (
                <Typography sx={{ fontSize: 12, color: 'error.main' }}>{error}</Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)} sx={{ fontSize: 13 }}>Cancel</Button>
            <Button
              onClick={handleCreate}
              variant="contained"
              disabled={saving || !formExercise || !formTarget || !formDate || !currentOneRm}
              sx={{ fontSize: 13 }}
            >
              {saving ? 'Saving...' : 'Create goal'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
          <DialogTitle sx={{ fontSize: 13 }}>Delete goal</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: 13 }}>
              Delete the {deleteTarget?.exercise_name} goal? Your logged sets are not affected.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)} sx={{ fontSize: 13 }}>Cancel</Button>
            <Button onClick={handleDelete} color="error" variant="contained" sx={{ fontSize: 13 }}>Delete</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Goals;
