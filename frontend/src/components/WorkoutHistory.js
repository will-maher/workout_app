import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Alert,
  IconButton,
  Button,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  format,
  parseISO,
  isToday,
  isYesterday,
  differenceInCalendarDays,
  startOfISOWeek,
  addDays,
  subWeeks,
} from 'date-fns';
import axios from 'axios';
import { API_BASE_URL } from '../App';

const DOT_PALETTE = [
  '#5DCAA5', '#F0997B', '#85B7EB', '#ED93B1', '#FAC775',
  '#AFA9EC', '#97C459', '#F09595', '#9FE1CB', '#B4B2A9',
];

const muscleColor = (group) => {
  if (!group) return '#888780';
  let hash = 0;
  for (let i = 0; i < group.length; i++) {
    hash = (hash * 31 + group.charCodeAt(i)) >>> 0;
  }
  return DOT_PALETTE[hash % DOT_PALETTE.length];
};

const relativeDate = (dateStr) => {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (differenceInCalendarDays(new Date(), date) < 7) return format(date, 'EEEE');
  if (date.getFullYear() === new Date().getFullYear()) return format(date, 'EEE d MMM');
  return format(date, 'd MMM yyyy');
};

const HEATMAP_WEEKS = 20;

const Heatmap = ({ workouts }) => {
  const { weeks, maxSets } = useMemo(() => {
    const setsByDate = {};
    workouts.forEach(w => {
      const key = w.date.slice(0, 10);
      setsByDate[key] = (setsByDate[key] || 0) + (w.sets?.length || 0);
    });
    const start = startOfISOWeek(subWeeks(new Date(), HEATMAP_WEEKS - 1));
    const weeks = [];
    let maxSets = 0;
    for (let wk = 0; wk < HEATMAP_WEEKS; wk++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const day = addDays(start, wk * 7 + d);
        const key = format(day, 'yyyy-MM-dd');
        const count = setsByDate[key] || 0;
        maxSets = Math.max(maxSets, count);
        days.push({ key, count, future: day > new Date() });
      }
      weeks.push(days);
    }
    return { weeks, maxSets };
  }, [workouts]);

  const cellColor = (cell) => {
    if (cell.future) return 'transparent';
    if (cell.count === 0) return 'rgba(255, 255, 255, 0.05)';
    const intensity = Math.min(1, cell.count / Math.max(maxSets * 0.75, 1));
    return `rgba(0, 212, 170, ${0.25 + intensity * 0.65})`;
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', gap: '3px', justifyContent: 'space-between' }}>
        {weeks.map((days, wi) => (
          <Box key={wi} sx={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
            {days.map((cell) => (
              <Box
                key={cell.key}
                title={`${cell.key}: ${cell.count} sets`}
                sx={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: '2px',
                  backgroundColor: cellColor(cell),
                }}
              />
            ))}
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.75 }}>
        Last {HEATMAP_WEEKS} weeks — darker means more sets
      </Typography>
    </Box>
  );
};

const WorkoutCard = ({ workout, onDelete }) => {
  const [open, setOpen] = useState(false);
  const sets = useMemo(
    () => (Array.isArray(workout.sets) ? workout.sets : []),
    [workout.sets]
  );
  const volume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  const groups = [...new Set(sets.map(s => s.muscle_group).filter(Boolean))];

  const byExercise = useMemo(() => {
    const acc = {};
    sets.forEach(s => {
      if (!acc[s.exercise_name]) acc[s.exercise_name] = [];
      acc[s.exercise_name].push(s);
    });
    return acc;
  }, [sets]);

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        backgroundColor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.75,
          py: 1.25,
          cursor: 'pointer',
          '&:active': { backgroundColor: 'rgba(255,255,255,0.03)' },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
            {relativeDate(workout.date)}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {groups.slice(0, 5).map(g => (
                <Box key={g} title={g} sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: muscleColor(g) }} />
              ))}
            </Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              {sets.length} sets · {Math.round(volume).toLocaleString()} kg
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <IconButton
            size="small"
            color="error"
            onClick={(e) => { e.stopPropagation(); onDelete(workout.id); }}
            sx={{ p: 0.5, opacity: 0.7 }}
          >
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <ExpandMoreIcon
            sx={{
              fontSize: 20,
              color: 'text.secondary',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </Box>
      </Box>
      <Collapse in={open} timeout={200} unmountOnExit>
        <Box sx={{ px: 1.75, pb: 1.5, borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
          {Object.entries(byExercise).map(([name, exSets]) => (
            <Box key={name} sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: muscleColor(exSets[0].muscle_group) }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{name}</Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', ml: 1.6 }}>
                {exSets.map(s => `${s.weight}×${s.reps}`).join('  ·  ')}
              </Typography>
            </Box>
          ))}
          {workout.notes && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontStyle: 'italic', mt: 0.5 }}>
              {workout.notes}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

const CACHE_KEY = 'history_cache';

const WorkoutHistory = () => {
  const [workouts, setWorkouts] = useState(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState(null);
  const [searchDate, setSearchDate] = useState(null);

  useEffect(() => {
    fetchWorkouts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchWorkouts = async (date = null, attempt = 0) => {
    try {
      if (attempt === 0) { setLoading(true); setError(''); setRetrying(false); }
      else setRetrying(true);
      const params = date ? { date: format(date, 'yyyy-MM-dd') } : {};
      const response = await axios.get(`${API_BASE_URL}/api/workouts`, { params });
      const data = Array.isArray(response.data) ? response.data : [];
      setWorkouts(data);
      if (!date) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
      }
      setError('');
    } catch (err) {
      console.error('Error fetching workouts:', err);
      if (err.response?.status === 401 || err.response?.status === 403) return;
      // Retry up to 3 times with exponential backoff for cold-start failures
      if (attempt < 3) {
        const delay = 2000 * Math.pow(2, attempt);
        setTimeout(() => fetchWorkouts(date, attempt + 1), delay);
        return;
      }
      setError('Failed to load workout history');
    } finally {
      if (attempt === 0 || attempt >= 3) { setLoading(false); setRetrying(false); }
    }
  };

  const handleDeleteWorkout = async () => {
    if (!workoutToDelete) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/workouts/${workoutToDelete}`);
      setWorkouts(ws => ws.filter(w => w.id !== workoutToDelete));
    } catch (err) {
      console.error('Error deleting workout:', err);
      setError('Failed to delete workout');
    } finally {
      setDeleteDialogOpen(false);
      setWorkoutToDelete(null);
    }
  };

  const requestDelete = (id) => {
    setWorkoutToDelete(id);
    setDeleteDialogOpen(true);
  };

  const monthGroups = useMemo(() => {
    const groups = [];
    let currentKey = null;
    workouts.forEach(w => {
      const key = format(parseISO(w.date), 'MMMM yyyy');
      if (key !== currentKey) {
        groups.push({ label: key, workouts: [] });
        currentKey = key;
      }
      groups[groups.length - 1].workouts.push(w);
    });
    return groups;
  }, [workouts]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ maxWidth: 520, mx: 'auto', mt: 2, px: { xs: 1.5, sm: 0 } }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', mb: 1.5 }}>
          History
        </Typography>

        {retrying && !error && (
          <Alert severity="info" sx={{ mb: 1.5, fontSize: 12 }}>
            Server is waking up, retrying…
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }} action={<Button color="inherit" size="small" onClick={() => fetchWorkouts(searchDate)}>Retry</Button>}>
            {error}
          </Alert>
        )}

        {loading && workouts.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Skeleton variant="rounded" height={92} />
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={56} />
          </Box>
        ) : (
          <>
            {!searchDate && workouts.length > 0 && <Heatmap workouts={workouts} />}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
              <DatePicker
                label="Jump to date"
                value={searchDate}
                onChange={setSearchDate}
                slotProps={{ textField: { size: 'small', sx: { flex: 1, '& .MuiInputBase-root': { fontSize: 13 } } } }}
              />
              <IconButton size="small" onClick={() => fetchWorkouts(searchDate)} disabled={!searchDate} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <SearchIcon sx={{ fontSize: 18 }} />
              </IconButton>
              {searchDate && (
                <Button size="small" onClick={() => { setSearchDate(null); fetchWorkouts(); }} sx={{ fontSize: 12 }}>
                  Clear
                </Button>
              )}
            </Box>

            {workouts.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ fontSize: 13, py: 4 }}>
                {searchDate ? 'No workouts on the selected date' : 'No workouts recorded yet'}
              </Typography>
            ) : (
              monthGroups.map(group => (
                <Box key={group.label} sx={{ mb: 2.5 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                    {group.label}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {group.workouts.map(w => (
                      <WorkoutCard key={w.id} workout={w} onDelete={requestDelete} />
                    ))}
                  </Box>
                </Box>
              ))
            )}
          </>
        )}

        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle sx={{ fontSize: 13 }}>Delete workout</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: 13 }}>
              Are you sure you want to delete this workout? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} sx={{ fontSize: 13 }}>Cancel</Button>
            <Button onClick={handleDeleteWorkout} color="error" variant="contained" sx={{ fontSize: 13 }}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default WorkoutHistory;
