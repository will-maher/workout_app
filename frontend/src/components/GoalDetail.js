import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Skeleton,
  Chip,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import axios from 'axios';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { API_BASE_URL } from '../App';
import { Panel, PanelLabel, PageHeader, StatCard, pageSx, TEAL } from './ui';

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

const ChangeRow = ({ label, delta }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
    <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{label}</Typography>
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
            label: { text: `Target ${goal.target_one_rm} kg`, align: 'left', x: 4, style: { color: '#FAC775', fontSize: '10px' } },
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
        // See Performance.js: area series default to threshold 0, which pins the
        // y-axis to zero and flattens the 1RM range.
        threshold: null,
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

  const status = goal ? (goal.achieved ? 'achieved' : goal.on_track ? 'on track' : 'behind') : '';
  const statusColor = goal ? (goal.achieved ? '#9FE1CB' : goal.on_track ? '#5DCAA5' : '#FAC775') : '#5DCAA5';

  return (
    <Box sx={pageSx}>
      <PageHeader
        title={goal ? goal.exercise_name : 'Goal'}
        left={
          <IconButton aria-label="Back to goals" onClick={() => navigate('/goals')} sx={{ ml: -1, p: 1, color: 'rgba(255,255,255,0.7)' }}>
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
        }
      />

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Skeleton variant="rounded" height={84} sx={{ borderRadius: 3 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={58} sx={{ borderRadius: 3 }} />)}
          </Box>
          <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} />
        </Box>
      ) : error ? (
        <Panel sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>{error}</Typography>
          {/* A goal that no longer exists can't be retried into existence. */}
          {error === 'Goal not found'
            ? <Button variant="outlined" size="small" onClick={() => navigate('/goals')} sx={{ fontSize: 12.5, textTransform: 'none' }}>Back to goals</Button>
            : <Button variant="outlined" size="small" onClick={loadGoal} sx={{ fontSize: 12.5, textTransform: 'none' }}>Retry</Button>}
        </Panel>
      ) : goal ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Panel>
            <PanelLabel
              right={<Chip label={status} size="small" sx={{ fontSize: 9.5, height: 19, fontWeight: 700, letterSpacing: '0.03em', color: '#04342C', backgroundColor: statusColor }} />}
            >
              {daysLeft}d left · by {format(parseISO(goal.target_date), 'd MMM yyyy')}
            </PanelLabel>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 1 }}>
              <Typography sx={{ fontSize: 22, fontWeight: 700, color: TEAL, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {goal.current_one_rm}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>→ {goal.target_one_rm} kg</Typography>
            </Box>
            <Box sx={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', borderRadius: 3, width: `${Math.min(100, goal.progress * 100)}%`, background: `linear-gradient(90deg, ${TEAL}99 0%, ${TEAL} 100%)`, transition: 'width 0.4s ease' }} />
            </Box>
          </Panel>

          {/* Current and target are already in the card above, so only the two
              figures it doesn't show are repeated here. */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            <StatCard label="All-time best" value={allTimeBest ? allTimeBest.value.toFixed(1) : '—'} unit={allTimeBest ? 'kg' : ''} />
            <StatCard
              label="Needed"
              value={requiredRate == null ? '—' : requiredRate === 0 ? 'Done' : `+${requiredRate.toFixed(1)}`}
              unit={requiredRate == null || requiredRate === 0 ? '' : 'kg / week'}
              accent={goal.achieved ? TEAL : undefined}
            />
          </Box>

          {scatterData.length === 0 ? (
            <Panel sx={{ py: 5, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>No logged sets for this exercise yet</Typography>
            </Panel>
          ) : (
            <>
              <Panel sx={{ pb: 0.5 }}>
                <PanelLabel>Estimated 1RM over time</PanelLabel>
                <HighchartsReact highcharts={Highcharts} options={chartOptions} />
              </Panel>

              {changes && (
                <Panel>
                  <PanelLabel>Progress</PanelLabel>
                  <ChangeRow label="Last 30 days" delta={changes.d30} />
                  <ChangeRow label="Last 90 days" delta={changes.d90} />
                  <ChangeRow label={`Since goal start (${format(parseISO(goal.start_date), 'd MMM')})`} delta={changes.sinceStart} />
                  {allTimeBest && (
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', mt: 1 }}>
                      All-time best of <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{allTimeBest.value.toFixed(1)} kg</Box>
                      {' '}on {format(new Date(allTimeBest.date), 'd MMM yyyy')}
                    </Typography>
                  )}
                </Panel>
              )}
            </>
          )}
        </Box>
      ) : null}
    </Box>
  );
};

export default GoalDetail;
