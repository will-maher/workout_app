import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Alert,
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
import { Panel, PanelLabel, PageHeader, pageSx, dialogPaperProps, DANGER } from './ui';

const relativeDate = (dateStr) => {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (differenceInCalendarDays(new Date(), date) < 7) return format(date, 'EEEE');
  if (date.getFullYear() === new Date().getFullYear()) return format(date, 'EEE d MMM');
  return format(date, 'd MMM yyyy');
};

const formatSetDuration = (secs) => {
  if (secs == null) return '';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s === 0 ? `${m}m` : `${m}:${String(s).padStart(2, '0')}`;
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

  const [picked, setPicked] = useState(null);

  return (
    <Panel>
      <PanelLabel
        right={
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
            {picked
              ? `${format(parseISO(picked.key), 'EEE d MMM')} · ${picked.count} set${picked.count === 1 ? '' : 's'}`
              : 'tap a day'}
          </Typography>
        }
      >
        Last {HEATMAP_WEEKS} weeks
      </PanelLabel>
      <Box sx={{ display: 'flex', gap: '3px', justifyContent: 'space-between' }}>
        {weeks.map((days, wi) => (
          <Box key={wi} sx={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
            {days.map((cell) => (
              <Box
                key={cell.key}
                onClick={() => !cell.future && setPicked(cell)}
                sx={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: '2px',
                  backgroundColor: cellColor(cell),
                  outline: picked?.key === cell.key ? '1px solid rgba(255,255,255,0.7)' : 'none',
                }}
              />
            ))}
          </Box>
        ))}
      </Box>
    </Panel>
  );
};

const WorkoutCard = ({ workout, onDelete }) => {
  const [open, setOpen] = useState(false);
  const sets = useMemo(
    () => (Array.isArray(workout.sets) ? workout.sets : []),
    [workout.sets]
  );
  // Mobility sets have no weight/reps, so they add nothing to volume.
  const volume = sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
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
    <Panel sx={{ p: 0, overflow: 'hidden' }}>
      <Box
        role="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.5,
          minHeight: 52,
          cursor: 'pointer',
          '&:active': { backgroundColor: 'rgba(255,255,255,0.03)' },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
            {relativeDate(workout.date)}
          </Typography>
          {/* Muscle groups by name: the old hash-coloured dots couldn't be read. */}
          <Typography noWrap sx={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', mt: 0.125 }}>
            {groups.slice(0, 3).join(' · ')}{groups.length > 3 ? ` +${groups.length - 3}` : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {sets.length} sets{volume > 0 ? ` · ${Math.round(volume).toLocaleString()} kg` : ''}
          </Typography>
          <ExpandMoreIcon
            sx={{
              fontSize: 20,
              color: 'rgba(255,255,255,0.35)',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </Box>
      </Box>
      <Collapse in={open} timeout={200} unmountOnExit>
        <Box sx={{ px: 1.5, pb: 1.25, borderTop: '1px solid rgba(255,255,255,0.06)', pt: 1 }}>
          {Object.entries(byExercise).map(([name, exSets]) => (
            <Box key={name} sx={{ mb: 0.875 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{name}</Typography>
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>
                {exSets.map(s =>
                  s.duration_seconds != null
                    ? formatSetDuration(s.duration_seconds)
                    : (s.weight == null && s.reps == null)
                      ? 'done'
                      : `${s.weight}×${s.reps}`
                ).join('  ·  ')}
              </Typography>
            </Box>
          ))}
          {workout.notes && (
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', fontStyle: 'italic', mt: 0.5 }}>
              {workout.notes}
            </Typography>
          )}
          {/* Delete lives inside the expanded card: it used to sit on every row,
              the most eye-catching thing in a list you scroll constantly. */}
          <Button
            onClick={() => onDelete(workout.id)}
            startIcon={<DeleteIcon sx={{ fontSize: 15 }} />}
            sx={{ mt: 0.5, ml: -0.75, fontSize: 11.5, textTransform: 'none', color: DANGER }}
          >
            Delete workout
          </Button>
        </Box>
      </Collapse>
    </Panel>
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
      setWorkouts(ws => {
        const next = ws.filter(w => w.id !== workoutToDelete);
        // Keep the cache in step, or the deleted workout flashes back from it
        // the next time this tab opens.
        if (!searchDate) {
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
        }
        return next;
      });
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
      <Box sx={pageSx}>
        <PageHeader title="History" />

        {retrying && !error && (
          <Alert severity="info" sx={{ mb: 1.25, fontSize: 12, borderRadius: 2 }}>
            Server is waking up, retrying…
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 1.25, fontSize: 12, borderRadius: 2 }} action={<Button color="inherit" size="small" onClick={() => fetchWorkouts(searchDate)}>Retry</Button>}>
            {error}
          </Alert>
        )}

        {loading && workouts.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Skeleton variant="rounded" height={120} sx={{ borderRadius: 3 }} />
            <Skeleton variant="rounded" height={52} sx={{ borderRadius: 3 }} />
            <Skeleton variant="rounded" height={52} sx={{ borderRadius: 3 }} />
            <Skeleton variant="rounded" height={52} sx={{ borderRadius: 3 }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {!searchDate && workouts.length > 0 && <Heatmap workouts={workouts} />}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {/* Picking a date searches straight away; there used to be a
                  separate, easily missed search button. */}
              <DatePicker
                label="Jump to date"
                value={searchDate}
                onChange={(d) => {
                  setSearchDate(d);
                  if (d && !Number.isNaN(d.getTime())) fetchWorkouts(d);
                }}
                disableFuture
                slotProps={{ textField: { size: 'small', sx: { flex: 1, '& .MuiInputBase-root': { fontSize: 13, borderRadius: 2 } } } }}
              />
              {searchDate && (
                <Button size="small" onClick={() => { setSearchDate(null); fetchWorkouts(); }} sx={{ fontSize: 12, textTransform: 'none' }}>
                  Clear
                </Button>
              )}
            </Box>

            {workouts.length === 0 ? (
              <Typography align="center" sx={{ fontSize: 13, py: 4, color: 'rgba(255,255,255,0.4)' }}>
                {searchDate ? 'No workout on that date' : 'No workouts recorded yet'}
              </Typography>
            ) : (
              monthGroups.map(group => (
                <Box key={group.label}>
                  <PanelLabel sx={{ mt: 0.5, mb: 0.75, px: 0.25 }}>{group.label}</PanelLabel>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {group.workouts.map(w => (
                      <WorkoutCard key={w.id} workout={w} onDelete={requestDelete} />
                    ))}
                  </Box>
                </Box>
              ))
            )}
          </Box>
        )}

        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={dialogPaperProps}>
          <DialogTitle sx={{ fontSize: 14, fontWeight: 700 }}>Delete workout?</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              Every set logged in it will be removed. This can't be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 2.5, pb: 2 }}>
            <Button onClick={() => setDeleteDialogOpen(false)} sx={{ fontSize: 13, textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
            <Button onClick={handleDeleteWorkout} sx={{ fontSize: 13, fontWeight: 700, textTransform: 'none', px: 2, borderRadius: 2, color: '#fff', backgroundColor: '#b33030', '&:hover': { backgroundColor: '#c73c3c' } }}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default WorkoutHistory;
