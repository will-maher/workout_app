import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Panel, PageHeader, pageSx, primaryButtonSx, dialogPaperProps, TEAL, DANGER } from './ui';

const Goals = () => {
  const navigate = useNavigate();
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
    const grouped = exercises.filter(ex => ex.category !== 'mobility').reduce((acc, ex) => {
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
      <Box sx={pageSx}>
        <PageHeader
          title="Goals"
          right={
            <Button startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => { resetForm(); setCreateOpen(true); }} sx={primaryButtonSx}>
              New goal
            </Button>
          }
        />

        {loading && goals.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Skeleton variant="rounded" height={104} sx={{ borderRadius: 3 }} />
            <Skeleton variant="rounded" height={104} sx={{ borderRadius: 3 }} />
          </Box>
        ) : goals.length === 0 && fetchError ? (
          <Panel sx={{ py: 5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
              Couldn't load goals
            </Typography>
            <Button size="small" variant="outlined" onClick={fetchGoals} sx={{ fontSize: 12.5, textTransform: 'none' }}>
              Retry
            </Button>
          </Panel>
        ) : goals.length === 0 ? (
          <Panel sx={{ py: 5, px: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.75 }}>
              No goals yet
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
              Set a target 1RM and a date. Progress shows here, on the Performance chart, and while you log sets.
            </Typography>
          </Panel>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {goals.map(goal => {
              const expectedPct = goal.target_one_rm === goal.start_one_rm ? 100 :
                Math.min(100, Math.max(0, ((goal.expected_one_rm - goal.start_one_rm) / (goal.target_one_rm - goal.start_one_rm)) * 100));
              const status = goal.achieved ? 'achieved' : goal.on_track ? 'on track' : 'behind';
              return (
                <Panel
                  key={goal.id}
                  role="button"
                  onClick={() => navigate(`/goals/${goal.id}`)}
                  sx={{ cursor: 'pointer', transition: 'border-color 0.2s ease', '&:hover': { borderColor: `${TEAL}66` } }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 0.25 }}>
                    <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, minWidth: 0 }}>
                      {goal.exercise_name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                      <Chip
                        label={status}
                        size="small"
                        sx={{
                          fontSize: 9.5, height: 19, fontWeight: 700, letterSpacing: '0.03em', color: '#04342C',
                          backgroundColor: goal.achieved ? '#9FE1CB' : goal.on_track ? '#5DCAA5' : '#FAC775',
                        }}
                      />
                      <IconButton
                        aria-label={`Delete ${goal.exercise_name} goal`}
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(goal); }}
                        sx={{ p: 1, mr: -1, color: 'rgba(255,255,255,0.28)', '&:hover': { color: DANGER } }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mb: 1.5 }}>
                    {goalSubtitle(goal)}
                  </Typography>
                  <Box sx={{ position: 'relative', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', mb: 1 }}>
                    <Box
                      sx={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${Math.min(100, goal.progress * 100)}%`,
                        borderRadius: 3,
                        background: `linear-gradient(90deg, ${TEAL}99 0%, ${TEAL} 100%)`,
                        transition: 'width 0.4s ease',
                      }}
                    />
                    <Box
                      title="Where the plan says you should be today"
                      sx={{ position: 'absolute', left: `${expectedPct}%`, top: -3, width: 2, height: 12, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.6)' }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                      now <Box component="span" sx={{ color: TEAL, fontWeight: 700 }}>{goal.current_one_rm} kg</Box>
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                      on pace {goal.expected_one_rm} kg
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                      target {goal.target_one_rm} kg
                    </Typography>
                  </Box>
                </Panel>
              );
            })}
          </Box>
        )}

        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm" PaperProps={dialogPaperProps}>
          <DialogTitle sx={{ fontSize: 14, fontWeight: 700 }}>New goal</DialogTitle>
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
          <DialogActions sx={{ px: 2.5, pb: 2 }}>
            <Button onClick={() => setCreateOpen(false)} sx={{ fontSize: 13, textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !formExercise || !formTarget || !formDate || !currentOneRm}
              sx={primaryButtonSx}
            >
              {saving ? 'Saving...' : 'Create goal'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} PaperProps={dialogPaperProps}>
          <DialogTitle sx={{ fontSize: 14, fontWeight: 700 }}>Delete goal?</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              Delete the {deleteTarget?.exercise_name} goal? Your logged sets are not affected.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 2.5, pb: 2 }}>
            <Button onClick={() => setDeleteTarget(null)} sx={{ fontSize: 13, textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
            <Button onClick={handleDelete} sx={{ fontSize: 13, fontWeight: 700, textTransform: 'none', px: 2, borderRadius: 2, color: '#fff', backgroundColor: '#b33030', '&:hover': { backgroundColor: '#c73c3c' } }}>Delete</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Goals;
