import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  CircularProgress,
  Snackbar,
  Alert as MuiAlert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import axios from 'axios';
import { API_BASE_URL } from '../App';
import ScrollablePicker from './ScrollablePicker';
import {
  migratePlan,
  emptyPlan,
  makeWorkout,
  makeExercise,
  makeId,
  groupExercises,
  dropOrphanSupersets,
  totalSets,
  musclesForWorkout,
  OPTIMAL_RANGES,
} from '../lib/plan';

// Re-exported so existing importers keep working; the data itself now lives in
// the plan module rather than in a view.
export { OPTIMAL_RANGES };

const TEAL = '#00d4aa';

const Panel = ({ children, sx = {}, ...rest }) => (
  <Box
    sx={{
      borderRadius: 3,
      border: '1px solid rgba(255,255,255,0.07)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 100%)',
      p: 1.5,
      ...sx,
    }}
    {...rest}
  >
    {children}
  </Box>
);

const PanelLabel = ({ children, right, sx = {} }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1, ...sx }}>
    <Typography sx={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.42)' }}>
      {children}
    </Typography>
    {right}
  </Box>
);

const WorkoutPlanner = ({ user }) => {
  const [plan, setPlan] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [exercises, setExercises] = useState([]);
  const [exerciseMap, setExerciseMap] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [usingCachedPlan, setUsingCachedPlan] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // dialogs
  const [exerciseDialog, setExerciseDialog] = useState(null); // { index, form }
  const [workoutDialog, setWorkoutDialog] = useState(null);   // { mode, name }
  const [confirm, setConfirm] = useState(null);               // { title, body, onConfirm }

  // ── loading ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchPlan = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/plan`);
        const migrated = migratePlan(res.data);
        setPlan(migrated);
        try { localStorage.setItem('cachedPlan', JSON.stringify(migrated)); } catch {}
        setLoadFailed(false);
        setUsingCachedPlan(false);
      } catch (error) {
        console.error('Error loading plan:', error);
        // A failed load must never produce a saveable plan that isn't the
        // user's, so there is no fallback to sample data here.
        const cached = localStorage.getItem('cachedPlan');
        if (cached) {
          try {
            setPlan(migratePlan(JSON.parse(cached)));
            setLoadFailed(false);
            setUsingCachedPlan(true);
            return;
          } catch { /* corrupt cache — fall through */ }
        }
        // A 404 means the user simply has no plan yet: start an empty one.
        if (error.response?.status === 404) {
          setPlan(emptyPlan());
          setLoadFailed(false);
          return;
        }
        setPlan(null);
        setLoadFailed(true);
      }
    };
    fetchPlan();
  }, [user, reloadKey]);

  useEffect(() => {
    const fetchExercises = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/exercises`);
        const list = Array.isArray(res.data) ? res.data : [];
        setExercises(list);
        const map = {};
        list.forEach((ex) => { map[ex.name] = ex; });
        setExerciseMap(map);
      } catch (error) {
        console.error('Error loading exercises:', error);
        setExercises([]);
        setExerciseMap({});
      } finally {
        setLoading(false);
      }
    };
    fetchExercises();
  }, []);

  // Keep a valid selection as workouts are added, renamed or removed.
  useEffect(() => {
    if (!plan) return;
    if (!plan.workouts.some((w) => w.id === selectedId)) {
      setSelectedId(plan.workouts[0]?.id || '');
    }
  }, [plan, selectedId]);

  const selected = plan?.workouts.find((w) => w.id === selectedId) || null;

  const groupedExercises = useMemo(() => {
    if (!exercises.length) return [];
    const grouped = exercises.reduce((acc, ex) => {
      const mg = ex.muscle_group || 'Other';
      if (!acc[mg]) acc[mg] = [];
      acc[mg].push(ex);
      return acc;
    }, {});
    return Object.keys(grouped).sort().map((mg) => ({
      label: mg,
      items: grouped[mg].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [exercises]);

  // ── mutations ─────────────────────────────────────────────────────────────
  const updateSelected = (fn) => {
    setPlan((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) =>
        w.id === selectedId ? { ...w, exercises: dropOrphanSupersets(fn(w.exercises)) } : w
      ),
    }));
  };

  const moveExercise = (index, delta) => {
    const target = index + delta;
    updateSelected((list) => {
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // Linking joins an exercise to the one above it; both end up with the same
  // supersetId, which is what makes them render as one bracketed group.
  const toggleSuperset = (index) => {
    updateSelected((list) => {
      if (index <= 0) return list;
      const next = [...list];
      const prev = next[index - 1];
      if (next[index].supersetId && next[index].supersetId === prev.supersetId) {
        next[index] = { ...next[index], supersetId: null };
      } else {
        const id = prev.supersetId || makeId('ss');
        next[index - 1] = { ...prev, supersetId: id };
        next[index] = { ...next[index], supersetId: id };
      }
      return next;
    });
  };

  const addWorkout = (name) => {
    const workout = makeWorkout(name);
    setPlan((prev) => ({ ...prev, workouts: [...prev.workouts, workout] }));
    setSelectedId(workout.id);
  };

  const renameWorkout = (name) => {
    setPlan((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => (w.id === selectedId ? { ...w, name } : w)),
    }));
  };

  const moveWorkout = (delta) => {
    setPlan((prev) => {
      const i = prev.workouts.findIndex((w) => w.id === selectedId);
      const target = i + delta;
      if (i < 0 || target < 0 || target >= prev.workouts.length) return prev;
      const workouts = [...prev.workouts];
      [workouts[i], workouts[target]] = [workouts[target], workouts[i]];
      return { ...prev, workouts };
    });
  };

  const deleteWorkout = () => {
    setPlan((prev) => ({ ...prev, workouts: prev.workouts.filter((w) => w.id !== selectedId) }));
  };

  // ── saving ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!plan || loadFailed) return;
    setSaving(true);
    setSaveError('');
    try {
      await axios.post(`${API_BASE_URL}/api/plan`, { plan_json: plan });
      localStorage.setItem('cachedPlan', JSON.stringify(plan));
      const refresh = await axios.get(`${API_BASE_URL}/api/plan`);
      const migrated = migratePlan(refresh.data);
      setPlan(migrated);
      localStorage.setItem('cachedPlan', JSON.stringify(migrated));
      setUsingCachedPlan(false);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error saving plan:', error);
      setSaveError(error.response?.data?.error || "Couldn't save your plan. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  const muscleRows = selected ? musclesForWorkout(selected, exerciseMap) : [];

  const openExerciseDialog = (index) => {
    const ex = selected.exercises[index];
    setExerciseDialog({
      index,
      form: { exercise: ex.exercise, sets: ex.sets, targetReps: ex.targetReps ?? '' },
    });
  };

  const commitExerciseDialog = () => {
    const { index, form } = exerciseDialog;
    updateSelected((list) =>
      list.map((ex, i) =>
        i === index
          ? {
              ...ex,
              exercise: form.exercise,
              sets: parseInt(form.sets, 10) || 1,
              targetReps: form.targetReps === '' ? null : (parseInt(form.targetReps, 10) || null),
            }
          : ex
      )
    );
    setExerciseDialog(null);
  };

  return (
    <Box sx={{ maxWidth: 540, mx: 'auto', pt: 1.5, pb: 2, px: { xs: 1.5, sm: 0 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
        <Typography sx={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.025em' }}>
          Workout Plan
        </Typography>
        <Button
          onClick={handleSave}
          disabled={saving || loadFailed || !plan}
          sx={{
            height: 32, px: 1.75, borderRadius: 2, fontSize: 12.5, fontWeight: 700,
            textTransform: 'none', color: '#06140F', backgroundColor: TEAL,
            '&:hover': { backgroundColor: '#00e6b8' },
            '&.Mui-disabled': { color: 'rgba(6,20,15,0.45)', backgroundColor: 'rgba(0,212,170,0.28)' },
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>

      {usingCachedPlan && (
        <MuiAlert severity="warning" sx={{ mb: 1.5, fontSize: 12, borderRadius: 2 }}>
          Showing your last saved plan — couldn't reach the server.
        </MuiAlert>
      )}
      {saveError && (
        <MuiAlert severity="error" sx={{ mb: 1.5, fontSize: 12, borderRadius: 2 }} onClose={() => setSaveError('')}>
          {saveError}
        </MuiAlert>
      )}

      {loadFailed ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>Couldn't load your plan.</Typography>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', mb: 2.5 }}>
            Not showing a default plan here on purpose — saving one would overwrite your real plan.
          </Typography>
          <Button variant="outlined" size="small" onClick={() => setReloadKey((k) => k + 1)} sx={{ fontSize: 12.5, textTransform: 'none' }}>
            Retry
          </Button>
        </Box>
      ) : loading || !plan ? (
        <Box display="flex" justifyContent="center" py={6}><CircularProgress size={22} /></Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>

          {/* Workout switcher */}
          <Panel sx={{ p: 1.25 }}>
            <Box sx={{ display: 'flex', gap: 0.625, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
              {plan.workouts.map((w) => {
                const on = w.id === selectedId;
                return (
                  <Box
                    key={w.id}
                    onClick={() => setSelectedId(w.id)}
                    sx={{
                      flex: '0 0 auto', px: 1.5, height: 34, borderRadius: 2,
                      display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none',
                      border: '1px solid', borderColor: on ? TEAL : 'rgba(255,255,255,0.09)',
                      backgroundColor: on ? TEAL : 'transparent',
                      color: on ? '#06140F' : 'rgba(255,255,255,0.62)',
                      fontWeight: on ? 800 : 500, fontSize: 12.5, whiteSpace: 'nowrap',
                      transition: 'all .18s ease',
                    }}
                  >
                    {w.name}
                  </Box>
                );
              })}
              <Box
                onClick={() => setWorkoutDialog({ mode: 'new', name: '' })}
                aria-label="Add workout"
                sx={{
                  flex: '0 0 auto', width: 34, height: 34, borderRadius: 2, cursor: 'pointer',
                  display: 'grid', placeItems: 'center',
                  border: '1px dashed rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.5)',
                  '&:hover': { borderColor: TEAL, color: TEAL },
                }}
              >
                <AddIcon sx={{ fontSize: 17 }} />
              </Box>
            </Box>
          </Panel>

          {!selected ? (
            <Panel sx={{ py: 5, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.5 }}>No workouts yet</Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', mb: 2 }}>
                Name them however you train — “Push A”, “Legs”, “Upper”.
              </Typography>
              <Button
                variant="outlined" size="small"
                onClick={() => setWorkoutDialog({ mode: 'new', name: '' })}
                sx={{ fontSize: 12.5, textTransform: 'none' }}
              >
                Add a workout
              </Button>
            </Panel>
          ) : (
            <>
              <Panel>
                <PanelLabel
                  right={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>
                        {selected.exercises.length} exercises · {totalSets(selected)} sets
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label="Workout options"
                        onClick={() => setWorkoutDialog({ mode: 'edit', name: selected.name })}
                        sx={{ p: 0.5, color: 'rgba(255,255,255,0.45)' }}
                      >
                        <MoreHorizIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  }
                >
                  {selected.name}
                </PanelLabel>

                {selected.exercises.length === 0 ? (
                  <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)', py: 2, textAlign: 'center' }}>
                    No exercises yet.
                  </Typography>
                ) : (
                  groupExercises(selected.exercises).map((group, gi) => {
                    const isSuperset = group.items.length > 1;
                    return (
                      <Box
                        key={group.items[0].index}
                        sx={{
                          position: 'relative',
                          mt: gi === 0 ? 0 : 0.5,
                          pl: isSuperset ? 1.25 : 0,
                          borderLeft: isSuperset ? '2px solid' : 'none',
                          borderColor: `${TEAL}66`,
                          borderRadius: isSuperset ? '0 0 0 4px' : 0,
                        }}
                      >
                        {isSuperset && (
                          <Typography sx={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.12em', color: `${TEAL}cc`, mb: 0.25 }}>
                            SUPERSET
                          </Typography>
                        )}
                        {group.items.map(({ exercise: ex, index }) => (
                          <Box
                            key={index}
                            onClick={() => openExerciseDialog(index)}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 1,
                              minHeight: 44, px: 1, mx: -0.5, borderRadius: 1.5, cursor: 'pointer',
                              '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' },
                            }}
                          >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography noWrap sx={{ fontSize: 13, fontWeight: 500, color: ex.exercise ? 'text.primary' : 'rgba(255,255,255,0.3)' }}>
                                {ex.exercise || 'Tap to choose an exercise'}
                              </Typography>
                              {exerciseMap[ex.exercise]?.muscle_group && (
                                <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>
                                  {exerciseMap[ex.exercise].muscle_group}
                                </Typography>
                              )}
                            </Box>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                              {ex.sets} × {ex.targetReps ?? '?'}
                            </Typography>
                            <ChevronRightIcon sx={{ fontSize: 17, color: 'rgba(255,255,255,0.22)', flexShrink: 0 }} />
                          </Box>
                        ))}
                      </Box>
                    );
                  })
                )}

                <Button
                  onClick={() => {
                    updateSelected((list) => [...list, makeExercise()]);
                    setTimeout(() => setExerciseDialog({ index: selected.exercises.length, form: { exercise: '', sets: 3, targetReps: 8 } }), 0);
                  }}
                  startIcon={<AddIcon />}
                  fullWidth
                  sx={{
                    mt: 1, height: 38, borderRadius: 2, fontSize: 12.5, fontWeight: 700, textTransform: 'none',
                    color: TEAL, border: '1px dashed', borderColor: 'rgba(255,255,255,0.14)',
                    '&:hover': { borderColor: TEAL, backgroundColor: `${TEAL}0f` },
                  }}
                >
                  Add exercise
                </Button>
              </Panel>

              {muscleRows.length > 0 && (
                <Panel>
                  <PanelLabel>This workout</PanelLabel>
                  {muscleRows.map(([muscle, sets]) => (
                    <Box key={muscle} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
                      <Typography sx={{ fontSize: 12.5 }}>{muscle}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>
                        {sets} sets
                        {OPTIMAL_RANGES[muscle] && (
                          <Box component="span" sx={{ color: 'rgba(255,255,255,0.28)', ml: 0.75 }}>
                            {OPTIMAL_RANGES[muscle].sets}/wk
                          </Box>
                        )}
                      </Typography>
                    </Box>
                  ))}
                  <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', mt: 0.75 }}>
                    Sets in this workout, with the suggested weekly total alongside.
                  </Typography>
                </Panel>
              )}
            </>
          )}
        </Box>
      )}

      {/* ── Exercise dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={!!exerciseDialog}
        onClose={() => setExerciseDialog(null)}
        fullWidth maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' } }}
      >
        <DialogTitle sx={{ fontSize: 14, fontWeight: 700 }}>Exercise</DialogTitle>
        <DialogContent>
          {exerciseDialog && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, mt: 0.5 }}>
              <ScrollablePicker
                items={groupedExercises}
                value={exerciseDialog.form.exercise}
                onChange={(val) => setExerciseDialog((d) => ({ ...d, form: { ...d.form, exercise: val } }))}
                label="Select exercise…"
                grouped
                getItemLabel={(i) => i.name}
                getItemValue={(i) => i.name}
                searchEnabled
                searchPlaceholder="Search exercises…"
                buttonHeight={44}
              />
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  label="Sets" type="number" size="small" sx={{ flex: 1 }}
                  value={exerciseDialog.form.sets}
                  onChange={(e) => setExerciseDialog((d) => ({ ...d, form: { ...d.form, sets: e.target.value } }))}
                  inputProps={{ min: 1, inputMode: 'numeric' }}
                />
                <TextField
                  label="Target reps" type="number" size="small" sx={{ flex: 1 }}
                  value={exerciseDialog.form.targetReps}
                  onChange={(e) => setExerciseDialog((d) => ({ ...d, form: { ...d.form, targetReps: e.target.value } }))}
                  inputProps={{ min: 1, inputMode: 'numeric' }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  onClick={() => { moveExercise(exerciseDialog.index, -1); setExerciseDialog(null); }}
                  disabled={exerciseDialog.index === 0}
                  startIcon={<ArrowUpwardIcon sx={{ fontSize: 16 }} />}
                  sx={{ flex: 1, fontSize: 11.5, textTransform: 'none', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}
                >
                  Up
                </Button>
                <Button
                  onClick={() => { moveExercise(exerciseDialog.index, 1); setExerciseDialog(null); }}
                  disabled={!selected || exerciseDialog.index >= selected.exercises.length - 1}
                  startIcon={<ArrowDownwardIcon sx={{ fontSize: 16 }} />}
                  sx={{ flex: 1, fontSize: 11.5, textTransform: 'none', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}
                >
                  Down
                </Button>
              </Box>

              {(() => {
                const idx = exerciseDialog.index;
                if (!selected || idx <= 0) return null;
                const cur = selected.exercises[idx];
                const prev = selected.exercises[idx - 1];
                const linked = cur?.supersetId && cur.supersetId === prev?.supersetId;
                return (
                  <Button
                    onClick={() => { toggleSuperset(idx); setExerciseDialog(null); }}
                    startIcon={linked ? <LinkOffIcon sx={{ fontSize: 16 }} /> : <LinkIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      fontSize: 11.5, textTransform: 'none', borderRadius: 2,
                      color: linked ? 'rgba(255,255,255,0.7)' : TEAL,
                      border: '1px solid', borderColor: linked ? 'rgba(255,255,255,0.1)' : `${TEAL}55`,
                    }}
                  >
                    {linked ? 'Remove from superset' : 'Superset with exercise above'}
                  </Button>
                );
              })()}

              <Button
                onClick={() => {
                  const idx = exerciseDialog.index;
                  setExerciseDialog(null);
                  setConfirm({
                    title: 'Remove exercise?',
                    body: 'It will be removed from this workout.',
                    onConfirm: () => updateSelected((list) => list.filter((_, i) => i !== idx)),
                  });
                }}
                startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                sx={{ fontSize: 11.5, textTransform: 'none', color: '#F09595', borderRadius: 2, border: '1px solid rgba(240,149,149,0.3)' }}
              >
                Remove from workout
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setExerciseDialog(null)} sx={{ fontSize: 13, textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button
            onClick={commitExerciseDialog}
            disabled={!exerciseDialog?.form.exercise}
            sx={{ fontSize: 13, fontWeight: 700, textTransform: 'none', px: 2, borderRadius: 2, color: '#06140F', backgroundColor: TEAL, '&:hover': { backgroundColor: '#00e6b8' }, '&.Mui-disabled': { backgroundColor: 'rgba(0,212,170,0.28)', color: 'rgba(6,20,15,0.45)' } }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Workout dialog ───────────────────────────────────────────────── */}
      <Dialog
        open={!!workoutDialog}
        onClose={() => setWorkoutDialog(null)}
        fullWidth maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' } }}
      >
        <DialogTitle sx={{ fontSize: 14, fontWeight: 700 }}>
          {workoutDialog?.mode === 'new' ? 'New workout' : 'Workout'}
        </DialogTitle>
        <DialogContent>
          {workoutDialog && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, mt: 0.5 }}>
              <TextField
                label="Name" size="small" fullWidth autoFocus
                placeholder="Push A"
                value={workoutDialog.name}
                onChange={(e) => setWorkoutDialog((d) => ({ ...d, name: e.target.value }))}
              />
              {workoutDialog.mode === 'edit' && (
                <>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      onClick={() => { moveWorkout(-1); setWorkoutDialog(null); }}
                      disabled={plan?.workouts.findIndex((w) => w.id === selectedId) === 0}
                      sx={{ flex: 1, fontSize: 11.5, textTransform: 'none', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}
                    >
                      Move earlier
                    </Button>
                    <Button
                      onClick={() => { moveWorkout(1); setWorkoutDialog(null); }}
                      disabled={plan && plan.workouts.findIndex((w) => w.id === selectedId) >= plan.workouts.length - 1}
                      sx={{ flex: 1, fontSize: 11.5, textTransform: 'none', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}
                    >
                      Move later
                    </Button>
                  </Box>
                  <Button
                    onClick={() => {
                      setWorkoutDialog(null);
                      setConfirm({
                        title: `Delete “${selected?.name}”?`,
                        body: 'The workout and its exercises will be removed from your plan.',
                        onConfirm: deleteWorkout,
                      });
                    }}
                    startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                    sx={{ fontSize: 11.5, textTransform: 'none', color: '#F09595', borderRadius: 2, border: '1px solid rgba(240,149,149,0.3)' }}
                  >
                    Delete workout
                  </Button>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setWorkoutDialog(null)} sx={{ fontSize: 13, textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button
            onClick={() => {
              const name = workoutDialog.name.trim();
              if (!name) return;
              if (workoutDialog.mode === 'new') addWorkout(name); else renameWorkout(name);
              setWorkoutDialog(null);
            }}
            disabled={!workoutDialog?.name.trim()}
            sx={{ fontSize: 13, fontWeight: 700, textTransform: 'none', px: 2, borderRadius: 2, color: '#06140F', backgroundColor: TEAL, '&:hover': { backgroundColor: '#00e6b8' }, '&.Mui-disabled': { backgroundColor: 'rgba(0,212,170,0.28)', color: 'rgba(6,20,15,0.45)' } }}
          >
            {workoutDialog?.mode === 'new' ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Confirm ──────────────────────────────────────────────────────── */}
      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        PaperProps={{ sx: { borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' } }}
      >
        <DialogTitle sx={{ fontSize: 14, fontWeight: 700 }}>{confirm?.title}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{confirm?.body}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setConfirm(null)} sx={{ fontSize: 13, textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button
            onClick={() => { confirm.onConfirm(); setConfirm(null); }}
            sx={{ fontSize: 13, fontWeight: 700, textTransform: 'none', px: 2, borderRadius: 2, color: '#fff', backgroundColor: '#b33030', '&:hover': { backgroundColor: '#c73c3c' } }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={2000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <MuiAlert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
          Plan saved
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};

export default WorkoutPlanner;
