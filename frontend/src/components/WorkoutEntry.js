import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subMonths, differenceInCalendarDays, parseISO } from 'date-fns';
import axios from 'axios';
import { API_BASE_URL, MOBILITY_PINK } from '../App';
import ScrollablePicker from './ScrollablePicker';

// Format a hold duration for display, e.g. 45 -> "45s", 90 -> "1:30".
const formatDuration = (secs) => {
  if (secs == null) return '';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s === 0 ? `${m}m` : `${m}:${String(s).padStart(2, '0')}`;
};

const TEAL = '#00d4aa';

const hideScrollbarSx = {
  '&::-webkit-scrollbar': { display: 'none' },
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
};

// Frosted surface used for every block on the tab, so the screen reads as one
// system rather than a stack of unrelated sections.
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
    <Typography
      sx={{
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: '0.11em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.42)',
      }}
    >
      {children}
    </Typography>
    {right}
  </Box>
);

// Compact completion ring for the planned-workout progress.
const ProgressRing = ({ value, total, accent, size = 40 }) => {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .55s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
};

// Horizontal rep selector — replaces the old 1-20 slider with a tactile strip
// that keeps the chosen value visible and one tap away.
const RepStrip = ({ value, onChange, accent, max = 30 }) => (
  <Box sx={{ display: 'flex', gap: 0.5, overflowX: 'auto', py: 0.25, ...hideScrollbarSx }}>
    {Array.from({ length: max }, (_, i) => i + 1).map((r) => {
      const active = value === r;
      return (
        <Box
          key={r}
          onClick={() => onChange(r)}
          sx={{
            flex: '0 0 auto',
            minWidth: 32,
            height: 32,
            px: 0.5,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            border: '1px solid',
            borderColor: active ? accent : 'rgba(255,255,255,0.09)',
            backgroundColor: active ? accent : 'transparent',
            color: active ? '#06140F' : 'rgba(255,255,255,0.62)',
            fontWeight: active ? 800 : 500,
            fontSize: 13,
            fontVariantNumeric: 'tabular-nums',
            transition: 'all .18s cubic-bezier(.4,0,.2,1)',
            '&:active': { transform: 'scale(0.92)' },
          }}
        >
          {r}
        </Box>
      );
    })}
  </Box>
);

// ── Weight wheel ────────────────────────────────────────────────────────────
const WEIGHT_STEP = 2.5;
const WEIGHT_MAX = 300;
const WHEEL_ITEM_H = 34;
const WHEEL_VISIBLE = 5;
const WHEEL_PAD = ((WHEEL_VISIBLE - 1) / 2) * WHEEL_ITEM_H;
const WEIGHT_OPTIONS = Array.from({ length: WEIGHT_MAX / WEIGHT_STEP + 1 }, (_, i) => i * WEIGHT_STEP);

// Reps this load is worth at a given 1RM — inverse Brzycki, the exact mirror of
// calculateWeightForReps so the two directions always agree.
const repsAtWeight = (w, oneRm) => {
  if (!oneRm || oneRm <= 0 || !w || w <= 0) return null;
  return (1.0278 - w / oneRm) / 0.0278;
};

// iOS-timer-style scroll wheel. Native scroll + snap points keeps the momentum
// physics and accessibility of a real scroller rather than emulating drag.
const WeightWheel = ({ value, onChange, accent, parkAt = 0 }) => {
  const ref = useRef(null);
  const scrolling = useRef(false);
  const endTimer = useRef(null);
  const frame = useRef(null);
  const programmatic = useRef(false);
  const progTimer = useRef(null);
  const progTarget = useRef(0);
  const settled = useRef(false); // first positioning jumps instantly

  const numericValue = parseFloat(value);
  const activeIndex = Number.isFinite(numericValue) ? Math.round(numericValue / WEIGHT_STEP) : -1;
  // With no weight chosen yet, park the wheel on the suggested working load so
  // the first scroll starts somewhere useful. Visual only — nothing is set
  // until the user actually moves it.
  const restIndex = activeIndex >= 0
    ? activeIndex
    : (parkAt > 0 ? Math.round(parkAt / WEIGHT_STEP) : 0);

  // Follow the value when it is changed from outside the wheel (typing, a
  // suggestion tap, prefill from history) — but never while the user scrolls.
  useEffect(() => {
    const el = ref.current;
    if (!el || scrolling.current) return;
    const target = restIndex * WHEEL_ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) {
      // Moving the wheel ourselves must never commit a value — otherwise
      // parking on a suggestion would silently fill in a weight the user
      // never chose, which could then be logged by accident. The guard is
      // released on arrival (a long smooth scroll outlasts any fixed timer),
      // with a timeout only as a backstop.
      programmatic.current = true;
      progTarget.current = target;
      clearTimeout(progTimer.current);
      el.scrollTo({ top: target, behavior: settled.current ? 'smooth' : 'auto' });
      settled.current = true;
      progTimer.current = setTimeout(() => { programmatic.current = false; }, 1200);
    }
  }, [restIndex]);

  const handleScroll = () => {
    if (programmatic.current) {
      const el = ref.current;
      if (el && Math.abs(el.scrollTop - progTarget.current) <= 1) {
        programmatic.current = false;
        clearTimeout(progTimer.current);
      }
      return;
    }
    scrolling.current = true;
    clearTimeout(endTimer.current);
    endTimer.current = setTimeout(() => { scrolling.current = false; }, 140);

    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.max(0, Math.min(WEIGHT_OPTIONS.length - 1, Math.round(el.scrollTop / WHEEL_ITEM_H)));
      const next = WEIGHT_OPTIONS[idx];
      if (parseFloat(value) !== next) {
        try { navigator.vibrate?.(4); } catch {}
        onChange(next % 1 === 0 ? String(next) : next.toFixed(1));
      }
    });
  };

  useEffect(() => () => {
    clearTimeout(endTimer.current);
    clearTimeout(progTimer.current);
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  return (
    <Box sx={{ position: 'relative', height: WHEEL_ITEM_H * WHEEL_VISIBLE }}>
      {/* selection band */}
      <Box
        sx={{
          position: 'absolute', left: 0, right: 0, top: '50%', height: WHEEL_ITEM_H,
          transform: 'translateY(-50%)', borderRadius: 1.5, pointerEvents: 'none',
          border: '1px solid', borderColor: `${accent}44`, backgroundColor: `${accent}12`,
        }}
      />
      <Box
        ref={ref}
        onScroll={handleScroll}
        sx={{
          height: '100%',
          overflowY: 'auto',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          py: `${WHEEL_PAD}px`,
          maskImage: 'linear-gradient(to bottom, transparent 0%, #000 26%, #000 74%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 26%, #000 74%, transparent 100%)',
          ...hideScrollbarSx,
        }}
      >
        {WEIGHT_OPTIONS.map((w, i) => {
          const active = i === activeIndex;
          return (
            <Box
              key={w}
              sx={{
                height: WHEEL_ITEM_H,
                scrollSnapAlign: 'center',
                display: 'grid',
                placeItems: 'center',
                fontSize: active ? 19 : 15,
                fontWeight: active ? 700 : 500,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
                color: active ? 'text.primary' : 'rgba(255,255,255,0.34)',
                transition: 'font-size .12s ease, color .12s ease',
              }}
            >
              {w % 1 === 0 ? w : w.toFixed(1)}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

// Big borderless numeric field used for the weight / reps readout. The unit
// sits in a fixed-width gutter so both halves stay optically balanced
// regardless of how wide the unit label is.
const MetricInput = ({ value, onChange, placeholder, accent, suffix, size = 36 }) => (
  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5 }}>
    <Box
      component="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type="number"
      inputMode="decimal"
      sx={{
        width: '100%',
        maxWidth: 104,
        textAlign: 'right',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        p: 0,
        m: 0,
        color: value ? 'text.primary' : 'rgba(255,255,255,0.16)',
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: '-0.035em',
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'inherit',
        caretColor: accent,
        '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
        MozAppearance: 'textfield',
        '&::placeholder': { color: 'rgba(255,255,255,0.16)' },
      }}
    />
    <Typography
      sx={{
        width: 32,
        flexShrink: 0,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.01em',
        color: 'rgba(255,255,255,0.32)',
      }}
    >
      {suffix}
    </Typography>
  </Box>
);

const StrengthCurveChart = React.memo(({ historicalSets, currentSets }) => {
  const data = useMemo(() => {
    const monthMap = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                       Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
    const parseDateKey = (df) => {
      if (!df) return null;
      const m = df.match(/(\d{2})\s+(\w{3})\s+(\d{2})/);
      return m ? `20${m[3]}-${monthMap[m[2]]}-${m[1]}` : null;
    };
    const sixAgo = format(subMonths(new Date(), 6), 'yyyy-MM-dd');

    const byReps = {};
    historicalSets.forEach(s => {
      const d = parseDateKey(s.date_formatted);
      if (!d || d < sixAgo) return;
      const r = parseInt(s.reps, 10);
      const w = parseFloat(s.weight);
      if (r >= 1 && r <= 30 && w > 0) {
        if (!byReps[r]) byReps[r] = [];
        byReps[r].push(w);
      }
    });

    const rKeys = Object.keys(byReps).map(Number).sort((a, b) => a - b);
    const ribbonPts = rKeys.map(r => {
      const sorted = [...byReps[r]].sort((a, b) => a - b);
      const n = sorted.length;
      const median = n % 2 === 0 ? (sorted[n/2-1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
      return { r, min: sorted[0], max: sorted[n-1], median };
    });

    const curPts = (currentSets || []).map(s => ({
      r: parseInt(s.reps, 10),
      w: parseFloat(s.weight),
    })).filter(p => p.r >= 1 && p.r <= 30 && p.w > 0);

    if (ribbonPts.length === 0 && curPts.length === 0) return null;

    const allW = [...ribbonPts.flatMap(p => [p.min, p.max]), ...curPts.map(p => p.w)];
    const allR = [...rKeys, ...curPts.map(p => p.r)];

    return {
      ribbonPts,
      curPts,
      xMin: Math.max(1, Math.min(...allR) - 1),
      xMax: Math.min(30, Math.max(...allR) + 2),
      yMin: Math.floor(Math.min(...allW) * 0.90),
      yMax: Math.ceil(Math.max(...allW) * 1.06),
    };
  }, [historicalSets, currentSets]);

  if (!data) return null;

  const { ribbonPts, curPts, xMin, xMax, yMin, yMax } = data;
  const W = 300, H = 130, PL = 34, PR = 8, PT = 6, PB = 22;
  const iW = W - PL - PR, iH = H - PT - PB;
  const xS = r => PL + ((r - xMin) / (xMax - xMin)) * iW;
  const yS = w => PT + (1 - (w - yMin) / (yMax - yMin)) * iH;

  const topEdge = ribbonPts.map(p => `${xS(p.r).toFixed(1)},${yS(p.max).toFixed(1)}`).join(' ');
  const botEdge = [...ribbonPts].reverse().map(p => `${xS(p.r).toFixed(1)},${yS(p.min).toFixed(1)}`).join(' ');
  const ribbonPoly = ribbonPts.length >= 2 ? `${topEdge} ${botEdge}` : null;
  const medianD = ribbonPts.map((p, i) => `${i===0?'M':'L'}${xS(p.r).toFixed(1)},${yS(p.median).toFixed(1)}`).join(' ');

  const spread = yMax - yMin;
  const tStep = spread <= 20 ? 5 : spread <= 60 ? 10 : spread <= 120 ? 20 : 50;
  const yTicks = [];
  for (let w = Math.ceil(yMin/tStep)*tStep; w <= yMax; w += tStep) yTicks.push(w);

  const xSpan = xMax - xMin;
  const xStep = xSpan <= 6 ? 1 : xSpan <= 14 ? 2 : 5;
  const xTicks = [];
  for (let r = Math.ceil(xMin/xStep)*xStep; r <= xMax; r += xStep) xTicks.push(r);

  const teal = '#00d4aa';

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      {yTicks.map(w => (
        <line key={w} x1={PL} x2={W-PR} y1={yS(w)} y2={yS(w)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
      {ribbonPoly && <polygon points={ribbonPoly} fill={`${teal}28`} />}
      {ribbonPts.length >= 2 && <>
        <polyline points={ribbonPts.map(p=>`${xS(p.r).toFixed(1)},${yS(p.max).toFixed(1)}`).join(' ')} fill="none" stroke={`${teal}55`} strokeWidth="1" strokeDasharray="3 2" />
        <polyline points={ribbonPts.map(p=>`${xS(p.r).toFixed(1)},${yS(p.min).toFixed(1)}`).join(' ')} fill="none" stroke={`${teal}55`} strokeWidth="1" strokeDasharray="3 2" />
        <path d={medianD} fill="none" stroke={teal} strokeWidth="2" strokeLinejoin="round" />
      </>}
      {ribbonPts.map(p => <circle key={p.r} cx={xS(p.r)} cy={yS(p.median)} r="2.5" fill={teal} />)}
      {curPts.map((p, i) => (
        <g key={i}>
          <circle cx={xS(p.r)} cy={yS(p.w)} r="6" fill={teal} opacity="0.18" />
          <circle cx={xS(p.r)} cy={yS(p.w)} r="3.5" fill={teal} stroke="#0a0a0a" strokeWidth="1.5" />
        </g>
      ))}
      <line x1={PL} x2={PL} y1={PT} y2={PT+iH} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <line x1={PL} x2={W-PR} y1={PT+iH} y2={PT+iH} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {yTicks.map(w => (
        <text key={w} x={PL-4} y={yS(w)+3} textAnchor="end" fontSize="8.5" fill="rgba(255,255,255,0.35)">{w}</text>
      ))}
      {xTicks.map(r => (
        <text key={r} x={xS(r)} y={H-5} textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.35)">{r}</text>
      ))}
      <text x={W-PR+3} y={H-5} textAnchor="start" fontSize="7.5" fill="rgba(255,255,255,0.22)">reps</text>
      <text x={PL-4} y={PT-1} textAnchor="end" fontSize="7.5" fill="rgba(255,255,255,0.22)">kg</text>
    </svg>
  );
});

const WorkoutEntry = ({ onStatusMessage }) => {
  const setMessage = onStatusMessage ?? (() => {});
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [duration, setDuration] = useState('30');
  const [sets, setSets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [recentSets, setRecentSets] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sliderReps, setSliderReps] = useState(8); // Default to 8 reps for slider
  const [userPlan, setUserPlan] = useState(null);
  const [selectedPlannedWorkout, setSelectedPlannedWorkout] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [recentExerciseIds, setRecentExerciseIds] = useState([]);
  const [showPlannedExercises, setShowPlannedExercises] = useState(() => {
    try {
      const v = localStorage.getItem('planned_exercises_expanded');
      return v === null ? true : v === 'true';
    } catch { return true; }
  });
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [oneRmRanges, setOneRmRanges] = useState({});
  const [goals, setGoals] = useState([]);
  const [temporaryExercises, setTemporaryExercises] = useState([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const haptic = (ms = 10) => { try { navigator.vibrate?.(ms); } catch {} };

  // Target reps from a planned row, carried across the exercise-change reset.
  const pendingRepsRef = useRef(null);

  // Remember whether the planned exercise list is collapsed between visits.
  useEffect(() => {
    try { localStorage.setItem('planned_exercises_expanded', String(showPlannedExercises)); } catch {}
  }, [showPlannedExercises]);

  const inputSurface = 'rgba(255,255,255,0.03)';

  // Calculate weight for given reps using Brzycki formula (reversed)
  const calculateWeightForReps = (targetReps, oneRepMax) => {
    if (!oneRepMax || targetReps <= 0) return 0;
    // Brzycki formula reversed: weight = 1RM * (1.0278 - 0.0278 * reps)
    return oneRepMax * (1.0278 - 0.0278 * targetReps);
  };

  // Calculate 1RM from weight and reps (same as Performance tab)
  const calc1RM = (weight, reps) => {
    if (!weight || !reps) return 0;
    return weight / (1.0278 - 0.0278 * reps);
  };



  // Simple LOESS implementation (same as Performance tab)
  const loess = (xs, ys, bandwidth = 0.08) => {
    const n = xs.length;
    const bw = Math.max(2, Math.floor(bandwidth * n));
    const result = [];
    for (let i = 0; i < n; i++) {
      const distances = xs.map(x => Math.abs(x - xs[i]));
      const idxs = distances
        .map((d, idx) => [d, idx])
        .sort((a, b) => a[0] - b[0])
        .slice(0, bw)
        .map(pair => pair[1]);
      const xw = idxs.map(j => xs[j]);
      const yw = idxs.map(j => ys[j]);
      const xbar = xw.reduce((a, b) => a + b, 0) / bw;
      const ybar = yw.reduce((a, b) => a + b, 0) / bw;
      const num = xw.reduce((sum, xj, k) => sum + (xj - xbar) * (yw[k] - ybar), 0);
      const den = xw.reduce((sum, xj) => sum + (xj - xbar) ** 2, 0);
      const beta = den === 0 ? 0 : num / den;
      const alpha = ybar - beta * xbar;
      result.push([xs[i], alpha + beta * xs[i]]);
    }
    return result;
  };

  // Estimated 1RM using LOESS from performance data (heaviest set per workout)
  const estimatedOneRepMax = useMemo(() => {
    if (!selectedExercise || recentSets.length === 0) return 0;
    
    try {
      // Group sets by workout date and get the heaviest set from each workout
      const workoutGroups = {};
      recentSets.forEach(set => {
        // Extract date from the formatted date string (e.g., "15 Dec 23")
        const dateMatch = set.date_formatted.match(/(\d{2})\s+(\w{3})\s+(\d{2})/);
        if (dateMatch) {
          const [, day, month, year] = dateMatch;
          const monthMap = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
            'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
          };
          const dateKey = `20${year}-${monthMap[month]}-${day}`;
          
          if (!workoutGroups[dateKey]) {
            workoutGroups[dateKey] = [];
          }
          workoutGroups[dateKey].push(set);
        }
      });
      
      // Get the heaviest set from each workout
      const heaviestSetsPerWorkout = Object.entries(workoutGroups).map(([date, sets]) => {
        const heaviestSet = sets.reduce((max, set) => 
          calc1RM(set.weight, set.reps) > calc1RM(max.weight, max.reps) ? set : max
        );
        return {
          date: date,
          one_rm: calc1RM(heaviestSet.weight, heaviestSet.reps),
        };
      }).sort((a, b) => a.date.localeCompare(b.date));
      
      if (heaviestSetsPerWorkout.length < 2) {
        // If not enough data for LOESS, use the latest 1RM
        return heaviestSetsPerWorkout.length > 0 ? heaviestSetsPerWorkout[heaviestSetsPerWorkout.length - 1].one_rm : 0;
      }
      
      // Prepare data for LOESS
      const scatterData = heaviestSetsPerWorkout.map(pt => [
        new Date(pt.date).getTime(),
        pt.one_rm
      ]);
      
      const xs = scatterData.map(d => d[0]);
      const ys = scatterData.map(d => d[1]);
      
      // Calculate LOESS smoothed line
      const loessLine = loess(xs, ys, 0.08);
      
      // Return the latest LOESS estimate (most recent point)
      return loessLine.length > 0 ? loessLine[loessLine.length - 1][1] : 0;
    } catch (error) {
      console.error('Error calculating LOESS estimate:', error);
      // Fallback to latest set's 1RM
      return recentSets.length > 0 ? calc1RM(recentSets[0].weight, recentSets[0].reps) : 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExercise, recentSets]);

  // Round weight to nearest 2.5kg increment
  const roundToNearest2_5 = (weight) => {
    return Math.round(weight / 2.5) * 2.5;
  };

  // Get planned workout options
  const getPlannedWorkoutOptions = () => {
    if (!userPlan) return [];
    const dayOrder = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ];
    return Object.keys(userPlan)
      .sort((a, b) => {
        // Extract day part (e.g., 'Monday' from 'Monday AM')
        const dayA = dayOrder.findIndex(day => a.startsWith(day));
        const dayB = dayOrder.findIndex(day => b.startsWith(day));
        // If both found, sort by day order, else fallback to string compare
        if (dayA !== -1 && dayB !== -1) return dayA - dayB;
        if (dayA !== -1) return -1;
        if (dayB !== -1) return 1;
        return a.localeCompare(b);
      })
      .map(day => ({
        id: day,
        name: day
      }));
  };

  // Get exercises for selected planned workout
  const getSelectedWorkoutExercises = () => {
    if (!userPlan || !selectedPlannedWorkout) return [];
    return userPlan[selectedPlannedWorkout] || [];
  };

  const plannedWorkoutStats = useMemo(() => {
    const plannedExercises = userPlan && selectedPlannedWorkout
      ? (userPlan[selectedPlannedWorkout] || [])
      : [];
    if (!plannedExercises.length) {
      return { total: 0, completed: 0 };
    }

    const plannedCounts = plannedExercises.reduce((acc, ex) => {
      const key = ex.exercise;
      acc[key] = (acc[key] || 0) + (parseInt(ex.sets, 10) || 0);
      return acc;
    }, {});

    const total = Object.values(plannedCounts).reduce((sum, count) => sum + count, 0);

    const completedCounts = sets.reduce((acc, set) => {
      const key = set.exercise_name;
      if (!plannedCounts[key]) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const completed = Object.keys(plannedCounts).reduce((sum, key) => {
      const planned = plannedCounts[key] || 0;
      const done = completedCounts[key] || 0;
      return sum + Math.min(planned, done);
    }, 0);

    return { total, completed };
  }, [sets, userPlan, selectedPlannedWorkout]);

  // Group exercises by muscle group
  const groupedExercises = useMemo(() => {
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return [];
    }

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
    try {
      const saved = localStorage.getItem('recent_exercises');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentExerciseIds(parsed);
        }
      }
    } catch (error) {
      console.warn('Unable to load recent exercises:', error);
    }
  }, []);

  useEffect(() => {
    if (!selectedExercise) return;
    const selectedId = parseInt(selectedExercise, 10);
    if (!selectedId) return;
    setRecentExerciseIds((prev) => {
      const updated = [selectedId, ...prev.filter((id) => id !== selectedId)].slice(0, 3);
      try {
        localStorage.setItem('recent_exercises', JSON.stringify(updated));
      } catch (error) {
        console.warn('Unable to save recent exercises:', error);
      }
      return updated;
    });
  }, [selectedExercise]);

  const recentExercises = useMemo(() => {
    if (!recentExerciseIds.length) return [];
    const exerciseMap = new Map(exercises.map((ex) => [ex.id, ex]));
    return recentExerciseIds
      .map((id) => exerciseMap.get(id))
      .filter(Boolean);
  }, [recentExerciseIds, exercises]);

  useEffect(() => {
    const initializeComponent = async () => {
      setIsInitializing(true);
      
      // Add timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        setIsInitializing(false);
      }, 10000); // 10 second timeout
      
      try {
        await fetchExercises();
        await fetchUserPlan();
        await fetchGoals();
      } catch (error) {
        console.error('Error initializing WorkoutEntry component:', error);
      } finally {
        clearTimeout(timeoutId);
        setIsInitializing(false);
      }
    };
    
    initializeComponent();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchExercises = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/exercises`);
      // Ensure exercises is always an array
      const exercisesArray = Array.isArray(response.data) ? response.data : [];
      setExercises(exercisesArray);
    } catch (error) {
      console.error('Error loading exercises:', error);
      setMessage('Error loading exercises');
      setExercises([]); // Set empty array on error
    }
  };

  const fetchUserPlan = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/plan`);
      if (response.data) {
        // Migrate 'Wed AM' to 'Wednesday AM' if present
        let plan = { ...response.data };
        if (plan['Wed AM']) {
          plan['Wednesday AM'] = plan['Wed AM'];
          delete plan['Wed AM'];
        }
        setUserPlan(plan);
      } else {
        setUserPlan(null);
      }
    } catch (error) {
      console.error('Error loading user plan:', error);
      setUserPlan(null);
    }
  };

  const fetchGoals = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/goals`);
      setGoals(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setGoals([]);
    }
  };

  const activeGoal = useMemo(() => {
    if (!selectedExercise || !goals.length) return null;
    return goals.find((g) => g.exercise_id === parseInt(selectedExercise, 10)) || null;
  }, [goals, selectedExercise]);

  const daysToGoal = useMemo(() => {
    if (!activeGoal) return null;
    return Math.max(0, differenceInCalendarDays(parseISO(activeGoal.target_date), new Date()));
  }, [activeGoal]);

  const fetchRecentData = useCallback(async () => {
    if (!selectedExercise) {
      setRecentSets([]);
      return;
    }
    try {
      setLoadingData(true);
      const response = await axios.get(`${API_BASE_URL}/api/stats/recent-sets?exercise_id=${selectedExercise}&limit=200`);
      setRecentSets(response.data);
    } catch (error) {
      console.error('Error fetching recent data:', error);
      setRecentSets([]);
    } finally {
      setLoadingData(false);
    }
  }, [selectedExercise]);

  // Switching exercise clears the entry fields — unless a planned row asked for
  // a specific target rep count, which is carried across the change.
  useEffect(() => {
    if (selectedExercise !== '') {
      setWeight('');
      if (pendingRepsRef.current != null) {
        setReps(String(pendingRepsRef.current));
        setSliderReps(pendingRepsRef.current);
        pendingRepsRef.current = null;
      } else {
        setReps('');
      }
      fetchRecentData();
    }
  }, [selectedExercise, fetchRecentData]);

  const currentExerciseSets = useMemo(
    () => sets.filter(s => s.exercise_id === parseInt(selectedExercise, 10)),
    [sets, selectedExercise]
  );

  // Mobility exercises are logged as a timed hold or a plain check-off rather
  // than weight/reps, so the Add-tab form and 1RM machinery adapt accordingly.
  const selectedExerciseInfo = useMemo(
    () => exercises.find(ex => ex.id === parseInt(selectedExercise, 10)) || null,
    [exercises, selectedExercise]
  );
  const isMobility = selectedExerciseInfo?.category === 'mobility';
  const trackingType = selectedExerciseInfo?.tracking_type
    || (isMobility ? 'duration' : 'weight_reps');

  // The whole composer re-tints for mobility so the mode is unmistakable.
  const accent = isMobility ? MOBILITY_PINK : TEAL;

  // Sets logged so far per exercise name — drives the per-exercise set pips
  // in the planned list.
  const completedByExercise = useMemo(
    () => sets.reduce((acc, s) => {
      acc[s.exercise_name] = (acc[s.exercise_name] || 0) + 1;
      return acc;
    }, {}),
    [sets]
  );

  // Reps currently being previewed: whatever is typed, else the last strip pick.
  const previewReps = reps && parseInt(reps, 10) > 0 ? parseInt(reps, 10) : sliderReps;

  // Suggested working weight for the previewed rep count, from the LOESS 1RM.
  // Replaces the old slider + "Use" pairing with an inline, tappable hint.
  const suggestedWeight = useMemo(() => {
    if (!estimatedOneRepMax || estimatedOneRepMax <= 0) return 0;
    return roundToNearest2_5(calculateWeightForReps(previewReps, estimatedOneRepMax));
  }, [estimatedOneRepMax, previewReps]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live read of what the wheel's current load is worth, so scrolling the
  // weight immediately answers "how many reps should this be?".
  const weightEquivalent = useMemo(() => {
    const w = parseFloat(weight);
    if (!estimatedOneRepMax || estimatedOneRepMax <= 0 || !Number.isFinite(w) || w <= 0) return null;
    const raw = repsAtWeight(w, estimatedOneRepMax);
    if (raw == null || !Number.isFinite(raw)) return null;
    const pct = Math.round((w / estimatedOneRepMax) * 100);
    // Past your estimated max the rep count stops meaning anything, so lead
    // with the percentage instead of an unhelpful "<1 reps".
    if (raw < 1) return { label: `${pct}%`, unit: 'of 1RM', sub: null, hint: 'above your estimated max', pct, reps: null };
    if (raw > 30) return { label: '30+', unit: 'reps', sub: `${pct}% of 1RM`, hint: 'warm-up / light', pct, reps: null };
    const rounded = Math.round(raw);
    return {
      label: String(rounded),
      unit: 'reps',
      sub: `${pct}% of 1RM`,
      hint: rounded <= 3 ? 'max strength' : rounded <= 6 ? 'strength range' : rounded <= 12 ? 'hypertrophy range' : 'endurance range',
      pct,
      reps: rounded,
    };
  }, [weight, estimatedOneRepMax]);

  const applySuggestion = () => {
    if (!suggestedWeight) return;
    setWeight(String(suggestedWeight));
    setReps(String(previewReps));
    haptic();
  };

  useEffect(() => {
    if (!selectedExercise) return;
    const goal = goals.find((g) => g.exercise_id === parseInt(selectedExercise, 10));
    if (goal) setSliderReps(5);
  }, [selectedExercise, goals]);

  // When the selected day changes, discard temporary exercises
  useEffect(() => {
    setTemporaryExercises([]);
  }, [selectedPlannedWorkout]);

  // Auto-add the selected exercise to the plan view if it isn't already there
  useEffect(() => {
    if (!selectedExercise || !selectedPlannedWorkout || !userPlan) return;
    const exercise = exercises.find(ex => ex.id === parseInt(selectedExercise, 10));
    if (!exercise) return;
    const planExercises = userPlan[selectedPlannedWorkout] || [];
    const isInPlan = planExercises.some(pe => pe.exercise === exercise.name);
    if (!isInPlan) {
      setTemporaryExercises(prev =>
        prev.some(te => te.id === exercise.id) ? prev : [...prev, exercise]
      );
    }
  }, [selectedExercise]); // eslint-disable-line react-hooks/exhaustive-deps

  // Validate numeric input
  const isNumeric = (val) => /^\d+(\.\d+)?$/.test(val);

  const handleAddSet = () => {
    if (!selectedExercise) {
      setMessage('Please select an exercise');
      return;
    }
    const exercise = exercises.find(ex => ex.id === parseInt(selectedExercise));
    const base = {
      id: Date.now(),
      exercise_id: parseInt(selectedExercise),
      exercise_name: exercise.name,
      muscle_group: exercise.muscle_group,
      tracking_type: trackingType,
      date: format(new Date(), 'yyyy-MM-dd'),
    };

    // Mobility: log a timed hold or a plain completion instead of weight/reps.
    if (isMobility) {
      if (trackingType === 'duration') {
        if (!duration || !isNumeric(duration) || parseInt(duration, 10) <= 0) {
          setMessage('Enter a hold duration in seconds');
          return;
        }
        setSets([...sets, { ...base, weight: null, reps: null, duration_seconds: parseInt(duration, 10) }]);
      } else {
        // checkoff — a row with no metrics simply means "done"
        setSets([...sets, { ...base, weight: null, reps: null, duration_seconds: null }]);
      }
      haptic();
      setMessage('');
      return;
    }

    if (!weight || !reps) {
      setMessage('Please fill in all fields');
      return;
    }
    if (!isNumeric(weight) || !isNumeric(reps)) {
      setMessage('Weight and reps must be numeric');
      return;
    }
    setSets([...sets, {
      ...base,
      weight: parseFloat(weight),
      reps: parseInt(reps),
      duration_seconds: null,
    }]);
    haptic();
    setMessage('');
    setReps('');
  };

  const handleRemoveSet = (setId) => {
    setSets(sets.filter(set => set.id !== setId));
  };

  // --- LocalStorage persistence for sets ---
  // Load sets from localStorage on mount
  useEffect(() => {
    try {
      const savedSets = localStorage.getItem('workout_sets');
      if (savedSets) {
        const parsedSets = JSON.parse(savedSets);
        if (Array.isArray(parsedSets)) {
          setSets(parsedSets);
        } else {
          console.warn('Invalid sets data in localStorage, clearing...');
          localStorage.removeItem('workout_sets');
        }
      }
    } catch (e) {
      console.error('Error parsing localStorage sets:', e);
      // Clear corrupted localStorage
      localStorage.removeItem('workout_sets');
    }
  }, []);

  // Save sets to localStorage whenever they change
  useEffect(() => {
    try {
      if (sets.length > 0) {
        localStorage.setItem('workout_sets', JSON.stringify(sets));
      } else {
        // Only clear localStorage if sets are empty and we're not in the middle of loading
        const savedSets = localStorage.getItem('workout_sets');
        if (savedSets) {
          localStorage.removeItem('workout_sets');
        }
      }
    } catch (error) {
      console.error('Error saving sets to localStorage:', error);
    }
  }, [sets]);

  // --- LocalStorage persistence for selected planned workout ---
  // Load selected planned workout from localStorage on mount
  useEffect(() => {
    try {
      const savedPlannedWorkout = localStorage.getItem('selected_planned_workout');
      if (savedPlannedWorkout) {
        setSelectedPlannedWorkout(savedPlannedWorkout);
      }
    } catch (error) {
      console.error('Error loading selected planned workout from localStorage:', error);
      localStorage.removeItem('selected_planned_workout');
    }
  }, []);

  // Save selected planned workout to localStorage whenever it changes
  useEffect(() => {
    try {
      if (selectedPlannedWorkout) {
        localStorage.setItem('selected_planned_workout', selectedPlannedWorkout);
      } else {
        localStorage.removeItem('selected_planned_workout');
      }
    } catch (error) {
      console.error('Error saving selected planned workout to localStorage:', error);
    }
  }, [selectedPlannedWorkout]);

  const handleSaveSets = async () => {
    setSaveConfirmOpen(false);
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
          weight: set.weight ?? null,
          reps: set.reps ?? null,
          duration_seconds: set.duration_seconds ?? null,
          set_number: setsByDate[set.date].length + 1,
        });
      });
      
      // Save each date as a separate workout
      for (const [date, dateSets] of Object.entries(setsByDate)) {
        await axios.post(`${API_BASE_URL}/api/workouts`, {
          date: date,
          sets: dateSets,
        });
      }
      
      setMessage('Sets saved successfully!');
      haptic(20);
      setSets([]);
      localStorage.removeItem('workout_sets'); // Clear localStorage after saving
    } catch (error) {
      console.error('Error saving sets:', error);
      setMessage('Error saving sets: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const recentBestSets = useMemo(() => {
    if (!Array.isArray(recentSets) || recentSets.length === 0) {
      return [];
    }

    const toDate = (value) => {
      if (!value) return null;
      if (typeof value === 'string' && value.includes('-')) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const groupedByDate = recentSets.reduce((acc, set) => {
      const key = set.date_formatted || set.date;
      if (!key) return acc;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(set);
      return acc;
    }, {});

    const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
      const dateA = toDate(a);
      const dateB = toDate(b);
      if (!dateA || !dateB) return 0;
      return dateB - dateA;
    });

    return sortedDates.slice(0, 10).map((dateKey) => {
      const setsForDate = groupedByDate[dateKey];
      const bestSet = setsForDate.reduce((best, current) => {
        if (!best) return current;
        return Number(current.weight) > Number(best.weight) ? current : best;
      }, null);

      return {
        date: dateKey,
        weight: bestSet?.weight ?? 0,
        reps: bestSet?.reps ?? 0,
      };
    });
  }, [recentSets]);

  const bestSetPastYear = useMemo(() => {
    if (!Array.isArray(recentSets) || recentSets.length === 0) {
      return null;
    }

    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(now.getFullYear() - 1);

    const filtered = recentSets.filter((set) => {
      const rawDate = set.date || set.date_formatted;
      const parsed = rawDate ? new Date(rawDate) : null;
      if (!parsed || Number.isNaN(parsed.getTime())) return false;
      return parsed >= yearAgo && parsed <= now;
    });

    if (filtered.length === 0) return null;

    const bestSet = filtered.reduce((best, current) => {
      if (!best) return current;
      return Number(current.weight) > Number(best.weight) ? current : best;
    }, null);

    return {
      label: 'Past year best',
      weight: bestSet?.weight ?? 0,
      reps: bestSet?.reps ?? 0,
    };
  }, [recentSets]);

  // Fetch 6-month 1RM range per exercise when sets change
  useEffect(() => {
    if (sets.length === 0) {
      setOneRmRanges({});
      return;
    }
    const uniqueExerciseIds = [...new Set(sets.map((s) => s.exercise_id))];
    const sixMonthsAgo = format(subMonths(new Date(), 6), 'yyyy-MM-dd');
    const fetchRanges = async () => {
      const ranges = {};
      await Promise.all(
        uniqueExerciseIds.map(async (exerciseId) => {
          try {
            const res = await axios.get(`${API_BASE_URL}/api/stats/performance/sets?exercise_id=${exerciseId}`);
            const allSets = Array.isArray(res.data) ? res.data : [];
            const filtered = allSets.filter((row) => row.date && row.date >= sixMonthsAgo);
            const oneRMs = filtered.map((row) => calc1RM(row.weight, row.reps)).filter((v) => v > 0);
            if (oneRMs.length > 0) {
              ranges[exerciseId] = {
                min: Math.min(...oneRMs),
                max: Math.max(...oneRMs),
              };
            }
          } catch (err) {
            console.error('Error fetching 1RM range for exercise', exerciseId, err);
          }
        })
      );
      setOneRmRanges(ranges);
    };
    fetchRanges();
  }, [sets]);

  const nudgeSx = {
    flex: 1,
    minWidth: 0,
    height: 32,
    borderRadius: 2,
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.72)',
    border: '1px solid rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    fontVariantNumeric: 'tabular-nums',
    '&:hover': { borderColor: accent, backgroundColor: 'rgba(255,255,255,0.05)' },
    '&:active': { transform: 'scale(0.94)' },
    transition: 'all .15s cubic-bezier(.4,0,.2,1)',
  };

  // Strength logs with a solid teal action; mobility stays outline-only in pink.
  const primaryActionSx = isMobility
    ? {
        mt: 1.5,
        height: 44,
        borderRadius: 2.5,
        fontWeight: 800,
        fontSize: 14,
        letterSpacing: '0.01em',
        textTransform: 'none',
        color: accent,
        border: '1.5px solid',
        borderColor: accent,
        backgroundColor: `${accent}0d`,
        '&:hover': { backgroundColor: `${accent}1f`, borderColor: accent },
        '&:active': { transform: 'scale(0.985)' },
        transition: 'transform .12s ease, background-color .2s ease',
      }
    : {
        mt: 1.5,
        height: 44,
        borderRadius: 2.5,
        fontWeight: 800,
        fontSize: 14,
        letterSpacing: '0.01em',
        textTransform: 'none',
        color: '#06140F',
        background: `linear-gradient(135deg, ${accent} 0%, ${accent}c8 100%)`,
        boxShadow: `0 4px 14px -8px ${accent}`,
        '&:hover': { background: `linear-gradient(135deg, ${accent} 0%, ${accent} 100%)`, boxShadow: `0 6px 18px -8px ${accent}` },
        '&:active': { transform: 'scale(0.985)' },
        transition: 'transform .12s ease, box-shadow .2s ease',
      };

  const plannedOptions = getPlannedWorkoutOptions();
  const hasPlan = userPlan && Object.keys(userPlan).length > 0;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ maxWidth: 540, mx: 'auto', pt: 1.5, pb: 2, px: { xs: 1.5, sm: 0 } }}>
        {isInitializing ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {[76, 120, 300].map((h, i) => (
              <Box
                key={i}
                sx={{
                  height: h,
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.05)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.01) 100%)',
                  animation: 'pulseFade 1.4s ease-in-out infinite',
                  '@keyframes pulseFade': { '0%,100%': { opacity: 0.5 }, '50%': { opacity: 0.85 } },
                }}
              />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>

            {/* ── Session header ─────────────────────────────────────────── */}
            <Panel sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.34)' }}>
                    {format(new Date(), 'EEEE d MMM')}
                  </Typography>
                  <Typography sx={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.025em', mt: 0.25, lineHeight: 1.2 }}>
                    {sets.length === 0 ? 'New session' : `${sets.length} set${sets.length === 1 ? '' : 's'} logged`}
                  </Typography>
                </Box>
                {selectedPlannedWorkout && plannedWorkoutStats.total > 0 && (
                  <ProgressRing value={plannedWorkoutStats.completed} total={plannedWorkoutStats.total} accent={TEAL} />
                )}
              </Box>

              {hasPlan && (
                <Box sx={{ mt: 1.25 }}>
                  <ScrollablePicker
                    items={plannedOptions}
                    value={selectedPlannedWorkout}
                    onChange={setSelectedPlannedWorkout}
                    label="Select a planned day"
                    getItemLabel={(item) => item.name}
                    getItemValue={(item) => item.id}
                    inputBackground={inputSurface}
                    buttonHeight={42}
                  />
                </Box>
              )}
            </Panel>

            {/* ── Planned workout ────────────────────────────────────────── */}
            {hasPlan && selectedPlannedWorkout && (
              <Panel>
                <PanelLabel
                  sx={{ mb: 1 }}
                  right={
                    <Box
                      onClick={() => { haptic(); setShowPlannedExercises((p) => !p); }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.25, cursor: 'pointer', userSelect: 'none',
                        color: 'rgba(255,255,255,0.45)', transition: 'color .2s ease', '&:hover': { color: 'text.primary' },
                      }}
                    >
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em' }}>
                        {showPlannedExercises ? 'HIDE' : 'SHOW'}
                      </Typography>
                      <ExpandMoreIcon sx={{ fontSize: 16, transform: showPlannedExercises ? 'rotate(180deg)' : 'none', transition: 'transform .25s cubic-bezier(.4,0,.2,1)' }} />
                    </Box>
                  }
                >
                  {selectedPlannedWorkout}
                </PanelLabel>

                {plannedWorkoutStats.total > 0 && (
                  <Box sx={{ mb: showPlannedExercises ? 1.5 : 0 }}>
                    <Box sx={{ display: 'flex', gap: 0.375 }}>
                      {Array.from({ length: plannedWorkoutStats.total }).map((_, index) => (
                        <Box
                          key={index}
                          sx={{
                            flex: 1,
                            height: 3,
                            borderRadius: 2,
                            backgroundColor: index < plannedWorkoutStats.completed ? TEAL : 'rgba(255,255,255,0.1)',
                            transition: 'background-color .35s cubic-bezier(.4,0,.2,1)',
                          }}
                        />
                      ))}
                    </Box>
                    <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', mt: 0.75, fontVariantNumeric: 'tabular-nums' }}>
                      {plannedWorkoutStats.completed} of {plannedWorkoutStats.total} sets complete
                    </Typography>
                  </Box>
                )}

                {showPlannedExercises && (
                  <Box>
                    {getSelectedWorkoutExercises().map((exercise, index) => {
                      const exerciseData = exercises.find((ex) => ex.name === exercise.exercise);
                      const isMobilityRow = exerciseData?.category === 'mobility';
                      const isRowSelected = exerciseData && selectedExercise === exerciseData.id;
                      const rowAccent = isMobilityRow ? MOBILITY_PINK : TEAL;
                      const target = parseInt(exercise.sets, 10) || 0;
                      const done = Math.min(target, completedByExercise[exercise.exercise] || 0);
                      return (
                        <Box
                          key={index}
                          onClick={() => {
                            if (!exerciseData) return;
                            const t = exercise.targetReps ? parseInt(exercise.targetReps, 10) : null;
                            if (selectedExercise === exerciseData.id) {
                              if (t) { setReps(String(t)); setSliderReps(t); }
                            } else {
                              pendingRepsRef.current = t;
                              setSelectedExercise(exerciseData.id);
                            }
                            haptic();
                          }}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1,
                            px: 1, py: 0.75, mx: -0.5, borderRadius: 1.5,
                            cursor: exerciseData ? 'pointer' : 'default',
                            borderLeft: '2px solid',
                            borderLeftColor: isRowSelected ? rowAccent : 'transparent',
                            backgroundColor: isRowSelected ? `${rowAccent}14` : 'transparent',
                            transition: 'all .2s cubic-bezier(.4,0,.2,1)',
                            '&:hover': { backgroundColor: isRowSelected ? `${rowAccent}1c` : 'rgba(255,255,255,0.03)' },
                          }}
                        >
                          <Typography
                            noWrap
                            sx={{
                              flex: 1, minWidth: 0, fontSize: 13,
                              fontWeight: isRowSelected ? 700 : 500,
                              color: isMobilityRow ? MOBILITY_PINK : isRowSelected ? 'text.primary' : 'rgba(255,255,255,0.82)',
                            }}
                          >
                            {exercise.exercise}
                          </Typography>
                          {target > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.375, flexShrink: 0 }}>
                              {Array.from({ length: Math.min(target, 8) }).map((_, i) => (
                                <Box
                                  key={i}
                                  sx={{
                                    width: 5, height: 5, borderRadius: '50%',
                                    backgroundColor: i < done ? rowAccent : 'rgba(255,255,255,0.15)',
                                    transition: 'background-color .3s ease',
                                  }}
                                />
                              ))}
                            </Box>
                          )}
                          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', flexShrink: 0, fontVariantNumeric: 'tabular-nums', minWidth: 42, textAlign: 'right' }}>
                            {exercise.sets} × {exercise.targetReps || '?'}
                          </Typography>
                        </Box>
                      );
                    })}

                    {temporaryExercises.map((exercise) => {
                      const isSelected = selectedExercise === exercise.id;
                      const isMobilityRow = exercise.category === 'mobility';
                      const rowAccent = isMobilityRow ? MOBILITY_PINK : TEAL;
                      return (
                        <Box
                          key={`tmp-${exercise.id}`}
                          onClick={() => { setSelectedExercise(exercise.id); haptic(); }}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1,
                            px: 1, py: 0.75, mx: -0.5, borderRadius: 1.5, cursor: 'pointer',
                            borderLeft: '2px solid',
                            borderLeftColor: isSelected ? rowAccent : 'transparent',
                            backgroundColor: isSelected ? `${rowAccent}10` : 'transparent',
                            transition: 'all .2s cubic-bezier(.4,0,.2,1)',
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' },
                          }}
                        >
                          <Typography
                            noWrap
                            sx={{
                              flex: 1, minWidth: 0, fontSize: 13, fontStyle: 'italic', fontWeight: 400,
                              color: isMobilityRow ? MOBILITY_PINK : 'rgba(255,255,255,0.5)',
                            }}
                          >
                            {exercise.name}
                          </Typography>
                          <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                            extra
                          </Typography>
                        </Box>
                      );
                    })}

                    {getSelectedWorkoutExercises().some((ex) => ex.notes) && (
                      <Box sx={{ mt: 1.25, pt: 1.25, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        {getSelectedWorkoutExercises().map((exercise, index) => {
                          if (!exercise.notes) return null;
                          return (
                            <Typography key={index} sx={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: 'rgba(255,255,255,0.42)', mb: 0.5, lineHeight: 1.5 }}>
                              <Box component="span" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{exercise.exercise}:</Box> {exercise.notes}
                            </Typography>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                )}
              </Panel>
            )}

            {/* ── Composer: exercise + entry ─────────────────────────────── */}
            <Panel sx={{ p: 0, overflow: 'hidden' }}>
              <Box sx={{ p: 1.5, pb: selectedExercise ? 1 : 1.5 }}>
                <PanelLabel>Exercise</PanelLabel>
                <ScrollablePicker
                  items={
                    groupedExercises.length > 0
                      ? [
                          ...(recentExercises.length > 0 ? [{ label: 'Recent', items: recentExercises }] : []),
                          ...groupedExercises,
                        ]
                      : [{ label: 'Loading...', items: [] }]
                  }
                  value={selectedExercise}
                  onChange={setSelectedExercise}
                  label="Select an exercise"
                  getItemLabel={(item) => item.name}
                  getItemValue={(item) => item.id}
                  grouped
                  getGroupLabel={(group) => group.label}
                  searchEnabled
                  searchPlaceholder="Search exercises..."
                  inputBackground={inputSurface}
                  autoFocusSearch={!isMobile}
                  buttonHeight={44}
                />
                {selectedExerciseInfo?.notes && (
                  <Typography sx={{ mt: 1, fontSize: 11.5, fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>
                    {selectedExerciseInfo.notes}
                  </Typography>
                )}
              </Box>

              {selectedExercise ? (
                <Box
                  sx={{
                    px: 1.5, pt: 1.5, pb: 1.5,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    background: `radial-gradient(130% 100% at 50% 0%, ${accent}0d 0%, transparent 70%)`,
                  }}
                >
                  {isMobility && trackingType === 'checkoff' ? (
                    <>
                      <Typography sx={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.5)', py: 1 }}>
                        Log this as completed for today
                      </Typography>
                      <Button onClick={handleAddSet} fullWidth startIcon={<AddIcon />} sx={{ ...primaryActionSx, mt: 0.5 }}>
                        Log completed
                      </Button>
                    </>
                  ) : isMobility ? (
                    <>
                      <MetricInput
                        value={duration}
                        onChange={setDuration}
                        placeholder="30"
                        accent={accent}
                        suffix="sec"
                      />
                      <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5 }}>
                        {[15, 30, 45, 60].map((s) => (
                          <Button
                            key={s}
                            onClick={() => { setDuration(String(s)); haptic(); }}
                            sx={{
                              ...nudgeSx,
                              borderColor: String(s) === String(duration) ? accent : 'rgba(255,255,255,0.09)',
                              color: String(s) === String(duration) ? accent : 'rgba(255,255,255,0.72)',
                            }}
                          >
                            {s}s
                          </Button>
                        ))}
                      </Box>
                      <Button onClick={handleAddSet} fullWidth startIcon={<AddIcon />} sx={primaryActionSx}>
                        Add hold
                      </Button>
                    </>
                  ) : (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
                        <MetricInput value={weight} onChange={setWeight} placeholder="0" accent={accent} suffix="kg" />
                        <Typography sx={{ fontSize: 18, fontWeight: 300, color: 'rgba(255,255,255,0.16)', flexShrink: 0 }}>×</Typography>
                        <MetricInput value={reps} onChange={setReps} placeholder="0" accent={accent} suffix="reps" />
                      </Box>

                      {/* Weight wheel + live equivalent-reps readout */}
                      <Box sx={{ display: 'flex', gap: 1.25, mt: 1.25, alignItems: 'stretch' }}>
                        <Box sx={{ flex: '0 0 42%' }}>
                          <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', mb: 0.5 }}>
                            Weight · kg
                          </Typography>
                          <WeightWheel value={weight} onChange={setWeight} accent={accent} parkAt={suggestedWeight} />
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                          <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', mb: 0.5 }}>
                            Worth about
                          </Typography>

                          <Box
                            sx={{
                              flex: 1, borderRadius: 2, px: 1.25, py: 1,
                              border: '1px solid rgba(255,255,255,0.07)',
                              backgroundColor: 'rgba(255,255,255,0.02)',
                              display: 'flex', flexDirection: 'column', justifyContent: 'center',
                            }}
                          >
                            {weightEquivalent ? (
                              <>
                                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                                  <Typography sx={{ fontSize: 30, fontWeight: 700, color: accent, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                                    {weightEquivalent.label}
                                  </Typography>
                                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>
                                    {weightEquivalent.unit}
                                  </Typography>
                                </Box>
                                {weightEquivalent.sub && (
                                  <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.42)', mt: 0.375 }}>
                                    {weightEquivalent.sub}
                                  </Typography>
                                )}
                                <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', mt: 0.125 }}>
                                  {weightEquivalent.hint}
                                </Typography>
                                {weightEquivalent.reps != null && weightEquivalent.reps !== previewReps && (
                                  <Box
                                    onClick={() => { setReps(String(weightEquivalent.reps)); setSliderReps(weightEquivalent.reps); haptic(); }}
                                    sx={{
                                      mt: 0.875, alignSelf: 'flex-start', cursor: 'pointer',
                                      fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em',
                                      color: accent, border: '1px solid', borderColor: `${accent}55`,
                                      borderRadius: 1, px: 0.75, py: 0.25,
                                      transition: 'background-color .2s ease',
                                      '&:hover': { backgroundColor: `${accent}1a` },
                                    }}
                                  >
                                    SET REPS
                                  </Box>
                                )}
                              </>
                            ) : (
                              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                                {estimatedOneRepMax > 0
                                  ? 'Scroll the wheel to see what a load is worth.'
                                  : 'Log a few sets to unlock rep targets for this lift.'}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ mt: 1.5 }}>
                        <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', mb: 0.75 }}>
                          Quick reps
                        </Typography>
                        <RepStrip
                          value={previewReps}
                          onChange={(r) => { setReps(String(r)); setSliderReps(r); haptic(); }}
                          accent={accent}
                        />
                      </Box>

                      {estimatedOneRepMax > 0 && suggestedWeight > 0 && (
                        <Box
                          onClick={applySuggestion}
                          sx={{
                            mt: 1.5, px: 1.25, py: 1, borderRadius: 2, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                            border: '1px solid', borderColor: `${accent}40`,
                            backgroundColor: `${accent}0a`,
                            transition: 'all .2s ease',
                            '&:hover': { backgroundColor: `${accent}16`, borderColor: accent },
                            '&:active': { transform: 'scale(0.99)' },
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                              Target for {previewReps} rep{previewReps === 1 ? '' : 's'}
                            </Typography>
                            <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
                              est. 1RM {roundToNearest2_5(estimatedOneRepMax)} kg
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                            <Typography sx={{ fontSize: 17, fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                              {suggestedWeight}
                              <Box component="span" sx={{ fontSize: 11, fontWeight: 600, ml: 0.25, opacity: 0.7 }}>kg</Box>
                            </Typography>
                            <Typography sx={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', color: accent, border: '1px solid', borderColor: `${accent}66`, borderRadius: 1, px: 0.75, py: 0.25 }}>
                              USE
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      <Button onClick={handleAddSet} fullWidth startIcon={<AddIcon />} sx={primaryActionSx}>
                        Add set
                      </Button>
                    </>
                  )}
                </Box>
              ) : (
                <Box sx={{ px: 1.5, pb: 1.75, pt: 0.25 }}>
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                    Choose an exercise to start logging
                  </Typography>
                </Box>
              )}
            </Panel>

            {/* ── Active goal ────────────────────────────────────────────── */}
            {activeGoal && (
              <Panel>
                <PanelLabel
                  right={
                    <Chip
                      label={activeGoal.achieved ? 'achieved' : activeGoal.on_track ? 'on track' : 'behind'}
                      size="small"
                      sx={{
                        fontSize: 9.5, height: 19, fontWeight: 700, letterSpacing: '0.03em', color: '#04342C',
                        backgroundColor: activeGoal.achieved ? '#9FE1CB' : activeGoal.on_track ? '#5DCAA5' : '#FAC775',
                      }}
                    />
                  }
                >
                  Goal{daysToGoal !== null ? ` · ${daysToGoal}d left` : ''}
                </PanelLabel>

                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 1 }}>
                  <Typography sx={{ fontSize: 22, fontWeight: 700, color: TEAL, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                    {activeGoal.current_one_rm}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                    → {activeGoal.target_one_rm} kg
                  </Typography>
                </Box>

                <Box sx={{ position: 'relative', height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <Box
                    sx={{
                      position: 'absolute', inset: 0, width: `${Math.min(100, activeGoal.progress * 100)}%`,
                      borderRadius: 3, background: `linear-gradient(90deg, ${TEAL}99 0%, ${TEAL} 100%)`,
                      transition: 'width .5s cubic-bezier(.4,0,.2,1)',
                    }}
                  />
                </Box>

                <Box
                  onClick={() => {
                    setWeight(roundToNearest2_5(activeGoal.expected_one_rm * (1.0278 - 0.0278 * 5)).toString());
                    setReps('5');
                    setSliderReps(5);
                    haptic();
                  }}
                  sx={{
                    mt: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', borderRadius: 1.5, px: 0.5, py: 0.5, mx: -0.5,
                    transition: 'background-color .2s ease',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' },
                  }}
                >
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    On-pace target today
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEAL, fontVariantNumeric: 'tabular-nums' }}>
                    {roundToNearest2_5(activeGoal.expected_one_rm * (1.0278 - 0.0278 * 5))} kg × 5
                  </Typography>
                </Box>
              </Panel>
            )}

            {/* ── This session ───────────────────────────────────────────── */}
            {sets.length > 0 && (
              <Panel>
                <PanelLabel
                  right={
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
                      {sets.length} set{sets.length === 1 ? '' : 's'}
                    </Typography>
                  }
                >
                  This session
                </PanelLabel>

                {(() => {
                  const groupedSets = sets.reduce((acc, set) => {
                    if (!acc[set.exercise_name]) acc[set.exercise_name] = [];
                    acc[set.exercise_name].push(set);
                    return acc;
                  }, {});

                  return Object.entries(groupedSets).map(([exerciseName, exerciseSets], gi) => {
                    const exerciseId = exerciseSets[0]?.exercise_id;
                    const exInfo = exercises.find((e) => e.id === exerciseId);
                    const rowAccent = exInfo?.category === 'mobility' ? MOBILITY_PINK : TEAL;
                    const range = exerciseId ? oneRmRanges[exerciseId] : null;
                    const current1RMs = exerciseSets.map((s) => calc1RM(s.weight, s.reps)).filter((v) => v > 0);
                    const hasBar = range && range.max > range.min && current1RMs.length > 0;
                    const barMin = range?.min ?? 0;
                    const barMax = range?.max ?? 1;
                    const span = (barMax - barMin) || 1;

                    return (
                      <Box key={exerciseName} sx={{ mt: gi === 0 ? 0 : 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700, color: rowAccent, flex: 1, minWidth: 0 }}>
                            {exerciseName}
                          </Typography>
                          {hasBar && (
                            <Box sx={{ width: 108, flexShrink: 0 }}>
                              <Box sx={{ position: 'relative', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.09)' }}>
                                {current1RMs.map((oneRm, idx) => {
                                  const pct = Math.max(0, Math.min(100, ((oneRm - barMin) / span) * 100));
                                  return (
                                    <Box
                                      key={idx}
                                      sx={{
                                        position: 'absolute', left: `${pct}%`, top: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        width: 7, height: 7, borderRadius: '50%',
                                        backgroundColor: rowAccent,
                                        boxShadow: `0 0 0 2px rgba(10,10,10,0.9)`,
                                      }}
                                    />
                                  );
                                })}
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.375 }}>
                                <Typography sx={{ fontSize: 8.5, color: 'rgba(255,255,255,0.28)', fontVariantNumeric: 'tabular-nums' }}>{barMin.toFixed(0)}</Typography>
                                <Typography sx={{ fontSize: 8.5, color: 'rgba(255,255,255,0.28)', fontVariantNumeric: 'tabular-nums' }}>{barMax.toFixed(0)} kg 1RM</Typography>
                              </Box>
                            </Box>
                          )}
                        </Box>

                        {exerciseSets.map((set, index) => (
                          <Box
                            key={set.id}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 1,
                              py: 0.5, px: 0.75, mx: -0.75, borderRadius: 1.5,
                              transition: 'background-color .18s ease',
                              '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' },
                            }}
                          >
                            <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.25)', width: 14, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                              {index + 1}
                            </Typography>
                            <Typography sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                              {set.duration_seconds != null
                                ? `Hold ${formatDuration(set.duration_seconds)}`
                                : (set.weight == null && set.reps == null)
                                  ? 'Completed'
                                  : `${set.weight} kg × ${set.reps}`}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => { handleRemoveSet(set.id); haptic(); }}
                              sx={{ p: 0.375, color: 'rgba(255,255,255,0.22)', flexShrink: 0, '&:hover': { color: '#F09595' } }}
                            >
                              <DeleteIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Box>
                        ))}
                      </Box>
                    );
                  });
                })()}
              </Panel>
            )}

            {/* ── Strength curve ─────────────────────────────────────────── */}
            {selectedExercise && !isMobility && (recentSets.length > 0 || currentExerciseSets.length > 0) && (
              <Panel>
                <PanelLabel
                  right={
                    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 14, height: 2, backgroundColor: TEAL, borderRadius: 1 }} />
                        <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)' }}>median</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: TEAL }} />
                        <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)' }}>today</Typography>
                      </Box>
                    </Box>
                  }
                >
                  Strength curve
                </PanelLabel>
                <StrengthCurveChart historicalSets={recentSets} currentSets={currentExerciseSets} />
              </Panel>
            )}

            {/* ── Recent history ─────────────────────────────────────────── */}
            {selectedExercise && (
              <Panel>
                <PanelLabel
                  right={
                    <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)' }}>tap to fill</Typography>
                  }
                >
                  Last 10 workouts
                </PanelLabel>

                {loadingData ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={20} />
                  </Box>
                ) : recentBestSets.length > 0 ? (
                  <Box>
                    {recentBestSets.map((set, index) => (
                      <Box
                        key={`${set.date}-${index}`}
                        onClick={() => { setWeight(set.weight.toString()); setReps(set.reps.toString()); haptic(); }}
                        sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                          py: 0.75, px: 0.75, mx: -0.75, borderRadius: 1.5, cursor: 'pointer',
                          transition: 'background-color .18s ease',
                          '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' },
                        }}
                      >
                        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{set.date}</Typography>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {set.weight} kg × {set.reps}
                        </Typography>
                      </Box>
                    ))}
                    {bestSetPastYear && (
                      <Box
                        sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                          mt: 0.75, pt: 1, borderTop: '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
                          {bestSetPastYear.label}
                        </Typography>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#facc15', fontVariantNumeric: 'tabular-nums' }}>
                          {bestSetPastYear.weight} kg × {bestSetPastYear.reps}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)' }}>
                    No recent sets found
                  </Typography>
                )}
              </Panel>
            )}

            {/* ── Sticky save bar ────────────────────────────────────────── */}
            {sets.length > 0 && (
              <Box
                sx={{
                  position: 'sticky',
                  // Clear the fixed bottom navigation (56px + safe area), or the
                  // bar pins itself underneath it and can't be tapped.
                  bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 12px)',
                  zIndex: 5,
                  mt: 0.5,
                }}
              >
                <Button
                  onClick={() => setSaveConfirmOpen(true)}
                  disabled={saving}
                  fullWidth
                  sx={{
                    height: 46,
                    borderRadius: 3,
                    fontWeight: 800,
                    fontSize: 14,
                    textTransform: 'none',
                    color: '#06140F',
                    background: `linear-gradient(135deg, ${TEAL} 0%, #00b894 100%)`,
                    boxShadow: '0 10px 30px -10px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': { background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL} 100%)` },
                    '&.Mui-disabled': { color: 'rgba(6,20,15,0.5)', background: 'rgba(0,212,170,0.4)' },
                    '&:active': { transform: 'scale(0.99)' },
                    transition: 'transform .12s ease',
                  }}
                >
                  {saving ? 'Saving…' : `Save workout · ${sets.length} set${sets.length === 1 ? '' : 's'}`}
                </Button>
              </Box>
            )}

            <Dialog
              open={saveConfirmOpen}
              onClose={() => setSaveConfirmOpen(false)}
              PaperProps={{ sx: { borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' } }}
            >
              <DialogTitle sx={{ fontSize: 15, fontWeight: 700 }}>Save workout?</DialogTitle>
              <DialogContent>
                <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                  This will log {sets.length} set{sets.length !== 1 ? 's' : ''} to your history.
                </Typography>
              </DialogContent>
              <DialogActions sx={{ px: 2.5, pb: 2 }}>
                <Button onClick={() => setSaveConfirmOpen(false)} sx={{ fontSize: 13, textTransform: 'none', color: 'text.secondary' }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSets}
                  disabled={saving}
                  sx={{
                    fontSize: 13, fontWeight: 700, textTransform: 'none', px: 2, borderRadius: 2,
                    color: '#06140F', backgroundColor: TEAL, '&:hover': { backgroundColor: '#00b894' },
                  }}
                >
                  Yes, save
                </Button>
              </DialogActions>
            </Dialog>

          </Box>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default WorkoutEntry; 