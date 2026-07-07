import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Skeleton,
  Chip,
  Alert,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import axios from 'axios';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { API_BASE_URL } from '../App';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const chartText = '#8b949e';
const gridColor = 'rgba(255, 255, 255, 0.06)';
const axisColor = 'rgba(255, 255, 255, 0.12)';
const tooltipStyle = {
  backgroundColor: '#1c242c',
  borderColor: '#2a333d',
  borderRadius: 8,
  style: { color: '#e8edf2', fontSize: '12px' },
};

function calc1RM(weight, reps) {
  if (!weight || !reps) return 0;
  return weight / (1.0278 - 0.0278 * reps);
}

function getDailyMax1RM(points) {
  const byDate = {};
  points.forEach((pt) => {
    const dateOnly = pt.date.slice(0, 10);
    if (!byDate[dateOnly] || pt.one_rm > byDate[dateOnly].one_rm) {
      byDate[dateOnly] = { ...pt, date: dateOnly };
    }
  });
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// Locally-weighted regression used to smooth the daily-max 1RM series into a
// trend line — matches the Performance tab so the two views agree.
function loess(xs, ys, bandwidth = 0.08) {
  const n = xs.length;
  const bw = Math.max(2, Math.floor(bandwidth * n));
  const result = [];
  for (let i = 0; i < n; i++) {
    const distances = xs.map((x) => Math.abs(x - xs[i]));
    const idxs = distances
      .map((d, idx) => [d, idx])
      .sort((a, b) => a[0] - b[0])
      .slice(0, bw)
      .map((pair) => pair[1]);
    const xw = idxs.map((j) => xs[j]);
    const yw = idxs.map((j) => ys[j]);
    const xbar = xw.reduce((a, b) => a + b, 0) / bw;
    const ybar = yw.reduce((a, b) => a + b, 0) / bw;
    const num = xw.reduce((sum, xj, k) => sum + (xj - xbar) * (yw[k] - ybar), 0);
    const den = xw.reduce((sum, xj) => sum + (xj - xbar) ** 2, 0);
    const beta = den === 0 ? 0 : num / den;
    const alpha = ybar - beta * xbar;
    result.push([xs[i], alpha + beta * xs[i]]);
  }
  return result;
}

// Value of the smoothed trend at (latest - days), used for "change over N days".
function trendValueAt(line, targetTime) {
  if (!line.length) return null;
  let idx = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i][0] <= targetTime) idx = i;
  }
  return line[idx][1];
}

const StatCard = ({ label, value, unit, accent }) => (
  <Box sx={{ backgroundColor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 1.5 }}>
    <Typography sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 18, fontWeight: 700, color: accent || 'text.primary', lineHeight: 1.1 }}>
      {value}
      {unit && (
        <Box component="span" sx={{ fontSize: 11, fontWeight: 500, color: 'text.secondary', ml: 0.5 }}>{unit}</Box>
      )}
    </Typography>
  </Box>
);

const ChangeRow = ({ label, delta }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{label}</Typography>
    <Typography sx={{ fontSize: 13, fontWeight: 600, color: delta == null ? 'text.secondary' : delta >= 0 ? 'primary.main' : '#F09595' }}>
      {delta == null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} kg`}
    </Typography>
  </Box>
);

const GoalDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [goal, setGoal] = useState(null);
  const [allSets, setAllSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadGoal = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get(`${API_BASE_URL}/api/goals`);
      const list = Array.isArray(res.data) ? res.data : [];
      const found = list.find((g) => String(g.id) === String(id));
      if (!found) {
        setError('Goal not found');
        setGoal(null);
        return;
      }
      setGoal(found);
      const setsRes = await axios.get(`${API_BASE_URL}/api/stats/performance/sets?exercise_id=${found.exercise_id}`);
      setAllSets(Array.isArray(setsRes.data) ? setsRes.data : []);
    } catch (err) {
      console.error('Error loading goal detail:', err);
      setError('Couldn’t load this goal');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadGoal();
  }, [loadGoal]);

  const dailyMaxPoints = useMemo(() => {
    if (!allSets.length) return [];
    return getDailyMax1RM(allSets.map((s) => ({ date: s.date, one_rm: calc1RM(s.weight, s.reps) })));
  }, [allSets]);

  const scatterData = useMemo(
    () => dailyMaxPoints.map((pt) => [new Date(pt.date).getTime(), pt.one_rm]),
    [dailyMaxPoints]
  );

  const loessLine = useMemo(() => {
    if (scatterData.length > 2) {
      return loess(scatterData.map((d) => d[0]), scatterData.map((d) => d[1]), 0.08);
    }
    return [];
  }, [scatterData]);

  const prPoint = useMemo(() => {
    if (!scatterData.length) return null;
    return scatterData.reduce((best, pt) => (pt[1] > best[1] ? pt : best), scatterData[0]);
  }, [scatterData]);

  // Historic performance changes over rolling windows, from the smoothed trend.
  const changes = useMemo(() => {
    if (!loessLine.length) return null;
    const latestTime = loessLine[loessLine.length - 1][0];
    const current = loessLine[loessLine.length - 1][1];
    const earliestTime = loessLine[0][0];
    const spanDays = (latestTime - earliestTime) / MS_PER_DAY;
    const windowChange = (days) => {
      if (spanDays < days * 0.7) return null;
      const past = trendValueAt(loessLine, latestTime - days * MS_PER_DAY);
      return past == null ? null : current - past;
    };
    let sinceStart = null;
    if (goal) {
      const startTime = new Date(goal.start_date).getTime();
      if (startTime >= earliestTime) {
        const startVal = trendValueAt(loessLine, startTime);
        if (startVal != null) sinceStart = current - startVal;
      } else {
        sinceStart = current - goal.start_one_rm;
      }
    }
    return {
      d30: windowChange(30),
      d90: windowChange(90),
      sinceStart,
    };
  }, [loessLine, goal]);

  const allTimeBest = useMemo(() => {
    if (!scatterData.length) return null;
    const best = scatterData.reduce((b, pt) => (pt[1] > b[1] ? pt : b), scatterData[0]);
    return { value: best[1], date: best[0] };
  }, [scatterData]);

  const goalSeries = useMemo(() => {
    if (!goal) return null;
    return [
      [new Date(goal.start_date).getTime(), goal.start_one_rm],
      [new Date(goal.target_date).getTime(), goal.target_one_rm],
    ];
  }, [goal]);

  const daysLeft = goal ? Math.max(0, differenceInCalendarDays(parseISO(goal.target_date), new Date())) : 0;

  const requiredRate = useMemo(() => {
    if (!goal) return null;
    const remaining = goal.target_one_rm - goal.current_one_rm;
    if (remaining <= 0) return 0;
    const weeksLeft = Math.max(daysLeft / 7, 1 / 7);
    return remaining / weeksLeft;
  }, [goal, daysLeft]);

  const chartOptions = useMemo(() => ({
    chart: {
      type: 'scatter',
      zoomType: 'xy',
      backgroundColor: 'transparent',
      style: { fontFamily: 'inherit' },
      height: 320,
      spacing: [8, 4, 8, 4],
    },
    title: { text: '' },
    xAxis: {
      type: 'datetime',
      title: { text: null },
      lineColor: axisColor,
      tickColor: 'transparent',
      gridLineWidth: 0,
      labels: { style: { fontSize: '11px', color: chartText } },
    },
    yAxis: {
      title: { text: null },
      gridLineColor: gridColor,
      softMin: scatterData.length ? Math.floor(Math.min(...scatterData.map((d) => d[1])) * 0.92) : undefined,
      softMax: goal ? Math.ceil(goal.target_one_rm * 1.02) : undefined,
      labels: { format: '{value} kg', style: { fontSize: '11px', color: chartText } },
      plotLines: goal
        ? [{
            value: goal.target_one_rm,
            color: 'rgba(250, 199, 117, 0.5)',
            dashStyle: 'Dash',
            width: 1.5,
            label: { text: `Target ${goal.target_one_rm} kg`, align: 'right', style: { color: '#FAC775', fontSize: '10px' } },
            zIndex: 3,
          }]
        : [],
    },
    legend: { enabled: false },
    tooltip: {
      ...tooltipStyle,
      formatter: function () {
        const label = this.series.name === 'PR'
          ? `PR: <b>${this.y.toFixed(1)} kg</b>`
          : this.series.name === 'Goal'
          ? `Goal: <b>${this.y.toFixed(1)} kg</b>`
          : `1RM: <b>${this.y.toFixed(1)} kg</b>`;
        return `<b>${format(new Date(this.x), 'MMM d, yyyy')}</b><br/>${label}`;
      },
    },
    plotOptions: {
      scatter: { marker: { radius: 3.5, fillColor: 'rgba(0, 212, 170, 0.55)', lineWidth: 0 }, states: { hover: { enabled: true } } },
    },
    series: [
      { name: 'Daily max 1RM', data: scatterData, type: 'scatter' },
      {
        name: 'Trend',
        data: loessLine,
        type: 'area',
        color: '#00d4aa',
        lineWidth: 2.5,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, 'rgba(0, 212, 170, 0.14)'], [1, 'rgba(0, 212, 170, 0)']],
        },
        marker: { enabled: false },
        enableMouseTracking: false,
      },
      { name: 'PR', data: prPoint ? [prPoint] : [], type: 'scatter', marker: { radius: 6, symbol: 'diamond', fillColor: '#facc15', lineWidth: 0 }, zIndex: 5 },
      ...(goalSeries
        ? [{
            name: 'Goal',
            data: goalSeries,
            type: 'line',
            color: chartText,
            lineWidth: 2,
            dashStyle: 'Dash',
            marker: { enabled: true, radius: 3, symbol: 'circle', fillColor: 'transparent', lineColor: chartText, lineWidth: 2 },
          }]
        : []),
    ],
    credits: { enabled: false },
  }), [scatterData, loessLine, prPoint, goalSeries, goal]);

  const sectionTitleSx = {
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'text.secondary',
    mb: 1,
  };

  const status = goal ? (goal.achieved ? 'achieved' : goal.on_track ? 'on track' : 'behind') : '';
  const statusColor = goal ? (goal.achieved ? '#9FE1CB' : goal.on_track ? '#5DCAA5' : '#FAC775') : '#5DCAA5';

  return (
    <Box maxWidth={600} mx="auto" mt={2} px={{ xs: 1.5, sm: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={() => navigate('/goals')} sx={{ ml: -0.5 }}>
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Typography sx={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
          {goal ? goal.exercise_name : 'Goal'}
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Skeleton variant="rounded" height={72} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
            <Skeleton variant="rounded" height={64} />
            <Skeleton variant="rounded" height={64} />
            <Skeleton variant="rounded" height={64} />
            <Skeleton variant="rounded" height={64} />
          </Box>
          <Skeleton variant="rounded" height={300} />
        </Box>
      ) : error ? (
        <Box sx={{ py: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          <Button variant="outlined" size="small" onClick={loadGoal} sx={{ fontSize: 13 }}>Retry</Button>
        </Box>
      ) : goal ? (
        <>
          {/* Goal progress card */}
          <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'text.secondary' }}>
                {daysLeft}d left
              </Typography>
              <Chip
                label={status}
                size="small"
                sx={{ fontSize: 10, height: 18, fontWeight: 600, color: '#04342C', backgroundColor: statusColor }}
              />
            </Box>
            <Box sx={{ height: 6, borderRadius: 3, backgroundColor: 'divider', mb: 1 }}>
              <Box sx={{ height: '100%', borderRadius: 3, width: `${goal.progress * 100}%`, backgroundColor: 'primary.main', transition: 'width 0.4s ease' }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{goal.current_one_rm} kg</Box>
                {' → '}
                <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{goal.target_one_rm} kg</Box>
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                by {format(parseISO(goal.target_date), 'd MMM yyyy')}
              </Typography>
            </Box>
          </Box>

          {/* Headline stats */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 2 }}>
            <StatCard label="Est. 1RM" value={goal.current_one_rm} unit="kg" accent="primary.main" />
            <StatCard label="Target" value={goal.target_one_rm} unit="kg" />
            <StatCard label="All-time best" value={allTimeBest ? allTimeBest.value.toFixed(1) : '—'} unit={allTimeBest ? 'kg' : ''} />
            <StatCard
              label="Needed"
              value={requiredRate == null ? '—' : requiredRate === 0 ? '0' : `+${requiredRate.toFixed(1)}`}
              unit={requiredRate == null || requiredRate === 0 ? '' : 'kg/wk'}
              accent={goal.achieved ? 'primary.main' : 'text.primary'}
            />
          </Box>

          {/* 1RM progression chart */}
          {scatterData.length === 0 ? (
            <Typography color="text.secondary" align="center" py={6} sx={{ fontSize: 13 }}>
              No logged sets for this exercise yet
            </Typography>
          ) : (
            <>
              <Typography sx={sectionTitleSx}>Estimated 1RM over time</Typography>
              <HighchartsReact highcharts={Highcharts} options={chartOptions} />

              {/* Historic performance changes */}
              {changes && (
                <Box mt={3}>
                  <Typography sx={sectionTitleSx}>Progress</Typography>
                  <Box>
                    <ChangeRow label="Last 30 days" delta={changes.d30} />
                    <ChangeRow label="Last 90 days" delta={changes.d90} />
                    <ChangeRow label={`Since goal start (${format(parseISO(goal.start_date), 'd MMM')})`} delta={changes.sinceStart} />
                  </Box>
                  {allTimeBest && (
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 1 }}>
                      All-time best of <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{allTimeBest.value.toFixed(1)} kg</Box>
                      {' '}on {format(new Date(allTimeBest.date), 'd MMM yyyy')}
                    </Typography>
                  )}
                </Box>
              )}
            </>
          )}
        </>
      ) : null}
    </Box>
  );
};

export default GoalDetail;
