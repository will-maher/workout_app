import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Skeleton,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import axios from 'axios';
import { API_BASE_URL, MOBILITY_PINK } from '../App';
import { Panel, PanelLabel, PageHeader, pageSx, primaryButtonSx, dialogPaperProps, DANGER } from './ui';

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

const CACHE_KEY = 'exercise_library_cache';
const emptyForm = { id: null, name: '', muscle_group: '', category: 'strength', tracking_type: 'duration', notes: '' };

const ExerciseLibrary = () => {
  const [exercises, setExercises] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      return Array.isArray(cached) ? cached : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');

  // One form for both adding and editing; `form.id` decides which.
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Refreshes in place: the list stays on screen (and keeps its scroll
  // position) instead of being swapped for a spinner on every change.
  const fetchExercises = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/exercises`);
      const list = Array.isArray(res.data) ? res.data : [];
      setExercises(list);
      setLoadError(false);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch {}
    } catch (err) {
      console.error('Error loading exercises:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExercises(); }, []);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.muscle_group) {
      setFormError('Name and muscle group are required');
      return;
    }
    setFormError('');
    setBusy(true);
    const body = {
      name: form.name.trim(),
      muscle_group: form.muscle_group,
      category: form.category,
      tracking_type: form.category === 'mobility' ? form.tracking_type : 'weight_reps',
      notes: form.notes.trim(),
    };
    try {
      if (form.id) await axios.put(`${API_BASE_URL}/api/exercises/${form.id}`, body);
      else await axios.post(`${API_BASE_URL}/api/exercises`, body);
      setForm(null);
      fetchExercises();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Couldn’t save the exercise');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    try {
      await axios.delete(`${API_BASE_URL}/api/exercises/${target.id}`);
      setForm(null);
      fetchExercises();
    } catch (err) {
      // Shown as a dismissible notice. This used to replace the whole list
      // with an error, which made a refused delete look like a broken page.
      setNotice(err.response?.data?.error || 'Couldn’t delete the exercise');
    }
  };

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? exercises.filter((ex) => ex.name.toLowerCase().includes(q) || (ex.muscle_group || '').toLowerCase().includes(q))
      : exercises;
    const grouped = filtered.reduce((acc, ex) => {
      const mg = ex.muscle_group || 'Other';
      if (!acc[mg]) acc[mg] = [];
      acc[mg].push(ex);
      return acc;
    }, {});
    const order = [
      ...muscleGroups.filter((mg) => grouped[mg]),
      ...Object.keys(grouped).filter((mg) => !muscleGroups.includes(mg)).sort(),
    ];
    return order.map((mg) => ({
      label: mg,
      items: grouped[mg].slice().sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [exercises, search]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Box sx={pageSx}>
      <PageHeader
        title="Exercise Library"
        right={
          <Button startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => { setFormError(''); setForm({ ...emptyForm }); }} sx={primaryButtonSx}>
            Add
          </Button>
        }
      />

      {notice && (
        <Alert severity="error" onClose={() => setNotice('')} sx={{ mb: 1.25, fontSize: 12, borderRadius: 2 }}>{notice}</Alert>
      )}
      {loadError && exercises.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1.25, fontSize: 12, borderRadius: 2 }} action={<Button color="inherit" size="small" onClick={fetchExercises}>Retry</Button>}>
          Showing your last loaded list — couldn't reach the server.
        </Alert>
      )}

      {loading && exercises.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: 3 }} />)}
        </Box>
      ) : loadError && exercises.length === 0 ? (
        <Panel sx={{ py: 5, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>Couldn't load exercises</Typography>
          <Button variant="outlined" size="small" onClick={() => { setLoading(true); fetchExercises(); }} sx={{ fontSize: 12.5, textTransform: 'none' }}>
            Retry
          </Button>
        </Panel>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${exercises.length} exercises`}
            size="small"
            fullWidth
            inputProps={{ 'aria-label': 'Search exercises' }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2, fontSize: 13, backgroundColor: 'rgba(255,255,255,0.03)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.09)' },
              },
            }}
          />

          {groups.length === 0 ? (
            <Panel sx={{ py: 5, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                {search ? `Nothing matches “${search}”` : 'No exercises yet'}
              </Typography>
            </Panel>
          ) : (
            groups.map((group) => (
              <Panel key={group.label} sx={{ pb: 0.5 }}>
                <PanelLabel
                  sx={{ mb: 0.25 }}
                  right={<Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)' }}>{group.items.length}</Typography>}
                >
                  {group.label}
                </PanelLabel>
                {group.items.map((ex) => (
                  <Box
                    key={ex.id}
                    role="button"
                    onClick={() => {
                      setFormError('');
                      setForm({
                        id: ex.id,
                        name: ex.name,
                        muscle_group: ex.muscle_group,
                        category: ex.category || 'strength',
                        tracking_type: ex.category === 'mobility' ? (ex.tracking_type || 'duration') : 'duration',
                        notes: ex.notes || '',
                      });
                    }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      minHeight: 44, px: 1, mx: -1, borderRadius: 1.5, cursor: 'pointer',
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' },
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0, py: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography noWrap sx={{ fontSize: 13, fontWeight: 500 }}>{ex.name}</Typography>
                        {ex.category === 'mobility' && (
                          <Chip
                            label={ex.tracking_type === 'checkoff' ? 'mobility · check off' : 'mobility · timed'}
                            size="small"
                            variant="outlined"
                            sx={{
                              height: 17, fontSize: 10, fontWeight: 700, flexShrink: 0,
                              color: MOBILITY_PINK, borderColor: MOBILITY_PINK,
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        )}
                      </Box>
                      {ex.notes && (
                        <Typography noWrap sx={{ fontSize: 11, fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>
                          {ex.notes}
                        </Typography>
                      )}
                    </Box>
                    <ChevronRightIcon sx={{ fontSize: 17, color: 'rgba(255,255,255,0.22)', flexShrink: 0 }} />
                  </Box>
                ))}
              </Panel>
            ))
          )}
        </Box>
      )}

      {/* Add / edit */}
      <Dialog open={!!form} onClose={() => !busy && setForm(null)} fullWidth maxWidth="xs" PaperProps={dialogPaperProps}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 700 }}>{form?.id ? 'Edit exercise' : 'New exercise'}</DialogTitle>
        <DialogContent>
          {form && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: 1 }}>
              <TextField label="Name" size="small" fullWidth autoFocus={!form.id} value={form.name} onChange={(e) => set({ name: e.target.value })} />
              <TextField label="Muscle group" size="small" select fullWidth value={form.muscle_group} onChange={(e) => set({ muscle_group: e.target.value })}>
                {muscleGroups.map((mg) => <MenuItem key={mg} value={mg}>{mg}</MenuItem>)}
              </TextField>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField label="Type" size="small" select sx={{ flex: 1 }} value={form.category} onChange={(e) => set({ category: e.target.value })}>
                  <MenuItem value="strength">Strength</MenuItem>
                  <MenuItem value="mobility">Mobility</MenuItem>
                </TextField>
                {form.category === 'mobility' && (
                  <TextField label="Logged as" size="small" select sx={{ flex: 1 }} value={form.tracking_type} onChange={(e) => set({ tracking_type: e.target.value })}>
                    <MenuItem value="duration">Timed hold</MenuItem>
                    <MenuItem value="checkoff">Check off</MenuItem>
                  </TextField>
                )}
              </Box>
              <TextField
                label="Notes (optional)" size="small" fullWidth multiline rows={2}
                placeholder="Form cues, variations…"
                value={form.notes} onChange={(e) => set({ notes: e.target.value })}
              />
              {formError && <Alert severity="error" sx={{ fontSize: 12, borderRadius: 2 }}>{formError}</Alert>}
              {form.id && (
                <Button
                  onClick={() => setConfirmDelete({ id: form.id, name: form.name })}
                  startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                  sx={{ fontSize: 11.5, textTransform: 'none', color: DANGER, borderRadius: 2, border: '1px solid rgba(240,149,149,0.3)' }}
                >
                  Delete exercise
                </Button>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setForm(null)} disabled={busy} sx={{ fontSize: 13, textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy} sx={primaryButtonSx}>
            {busy ? 'Saving…' : form?.id ? 'Save' : 'Add exercise'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} PaperProps={dialogPaperProps}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 700 }}>Delete “{confirmDelete?.name}”?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            Exercises with logged sets can't be deleted, so your history is safe.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(null)} sx={{ fontSize: 13, textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleDelete} sx={{ fontSize: 13, fontWeight: 700, textTransform: 'none', px: 2, borderRadius: 2, color: '#fff', backgroundColor: '#b33030', '&:hover': { backgroundColor: '#c73c3c' } }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExerciseLibrary;
