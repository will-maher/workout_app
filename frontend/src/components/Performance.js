import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Skeleton,
  Chip,
} from '@mui/material';
import ScrollablePicker from './ScrollablePicker';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import axios from 'axios';
import { format, parseISO, startOfISOWeek, subMonths, subYears, subWeeks, differenceInCalendarDays } from 'date-fns';
import { OPTIMAL_RANGES } from '../lib/plan';
import { API_BASE_URL, MOBILITY_PINK } from '../App';
import { Panel, PanelLabel, StatCard, pageSx, TEAL, DANGER } from './ui';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LAST_EXERCISE_KEY = 'performance_last_exercise';
const SETS_PREVIEW = 12;

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
  points.forEach(pt => {
    const dateOnly = pt.date.slice(0, 10);
    if (!byDate[dateOnly] || pt.one_rm > byDate[dateOnly].one_rm) {
      byDate[dateOnly] = { ...pt, date: dateOnly };
    }
  });
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function loess(xs, ys, bandwidth = 0.08) {
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
}

// Convert ISO week string (e.g. "2024-W12") to the Monday of that week
function isoWeekToDate(weekStr) {
  const [yearStr, weekStr2] = weekStr.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr2);
  const jan4 = new Date(year, 0, 4);
  const weekStart = startOfISOWeek(jan4);
  weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
  return weekStart;
}

const Performance = () => {
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [allSets, setAllSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [weeklySetsData, setWeeklySetsData] = useState([]);
  const [muscleGroup, setMuscleGroup] = useState('');
  const [timeRange, setTimeRange] = useState('6m');
  const [goals, setGoals] = useState([]);
  const [showAllSets, setShowAllSets] = useState(false);
  const latestExercise = useRef('');

  useEffect(() => {
    fetchExercises();
    axios.get(`${API_BASE_URL}/api/goals`)
      .then(res => setGoals(Array.isArray(res.data) ? res.data : []))
      .catch(() => setGoals([]));
  }, []);

  useEffect(() => {
    setShowAllSets(false);
    latestExercise.current = selectedExercise;
    if (selectedExercise) {
      try { localStorage.setItem(LAST_EXERCISE_KEY, String(selectedExercise)); } catch {}
      fetchPerformanceData(selectedExercise);
    } else {
      setAllSets([]);
    }
  }, [selectedExercise]);

  useEffect(() => {
    if (selectedExercise && exercises.length > 0) {
      const ex = exercises.find(e => e.id === parseInt(selectedExercise, 10));
      setMuscleGroup(ex?.muscle_group || '');
    } else {
      setMuscleGroup('');
    }
  }, [selectedExercise, exercises]);

  const fetchWeeklySetsData = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/stats/weekly-sets-by-muscle-group`);
      setWeeklySetsData(res.data.filter(row => row.muscle_group === muscleGroup));
    } catch (err) {
      console.error('Error fetching weekly sets data:', err);
      setWeeklySetsData([]);
    }
  }, [muscleGroup]);

  useEffect(() => {
    if (muscleGroup) {
      fetchWeeklySetsData();
    } else {
      setWeeklySetsData([]);
    }
  }, [muscleGroup, fetchWeeklySetsData]);

  const fetchExercises = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/exercises`);
      const list = Array.isArray(res.data) ? res.data : [];
      setExercises(list);
      const remembered = parseInt(localStorage.getItem(LAST_EXERCISE_KEY), 10);
      const start = list.find(e => e.id === remembered)
        || list.find(e => e.name.toLowerCase().includes('barbell bench press'));
      if (start) setSelectedExercise(start.id);
    } catch (err) {
      console.error('Error loading exercises:', err);
      setError('Couldn’t load exercises');
      setExercises([]);
    }
  };

  // Show the cached sets for this exercise straight away and refresh behind
  // them, so switching exercise (or opening the tab with no signal) doesn't
  // blank the whole screen to skeletons.
  const fetchPerformanceData = async (exerciseId) => {
    const cacheKey = `perf_sets_${exerciseId}`;
    let hadCache = false;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey));
      if (Array.isArray(cached)) { setAllSets(cached); hadCache = true; }
    } catch { /* ignore a corrupt cache */ }
    if (!hadCache) setAllSets([]);
    setLoading(!hadCache);
    setError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/api/stats/performance/sets?exercise_id=${exerciseId}`);
      const data = Array.isArray(res.data) ? res.data : [];
      // Ignore a response for an exercise the user has already moved off.
      if (latestExercise.current !== exerciseId) return;
      setAllSets(data);
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
    } catch (err) {
      console.error('Error fetching performance data:', err);
      if (latestExercise.current !== exerciseId) return;
      if (!hadCache) setError('Couldn’t load this exercise');
    } finally {
      if (latestExercise.current === exerciseId) setLoading(false);
    }
  };

  const activeGoal = useMemo(() => {
    if (!selectedExercise || !goals.length) return null;
    return goals.find(g => g.exercise_id === parseInt(selectedExercise, 10)) || null;
  }, [goals, selectedExercise]);

  const rangeStart = useMemo(() => {
    if (timeRange === '3m') return subMonths(new Date(), 3);
    if (timeRange === '6m') return subMonths(new Date(), 6);
    if (timeRange === '1y') return subYears(new Date(), 1);
    return null;
  }, [timeRange]);

  const filteredSets = useMemo(() => {
    if (!rangeStart) return allSets;
    return allSets.filter((set) => {
      const parsed = parseISO(set.date);
      return parsed >= rangeStart;
    });
  }, [allSets, rangeStart]);

  const filteredDailyMaxPoints = useMemo(() => {
    if (!filteredSets.length) return [];
    const points = filteredSets.map((set) => ({
      date: set.date,
      one_rm: calc1RM(set.weight, set.reps),
    }));
    return getDailyMax1RM(points);
  }, [filteredSets]);

  // Headline stats from full unfiltered history
  const headline = useMemo(() => {
    if (!allSets.length) return null;
    const dailyMax = getDailyMax1RM(allSets.map(s => ({ date: s.date, one_rm: calc1RM(s.weight, s.reps) })));
    if (!dailyMax.length) return null;
    const xs = dailyMax.map(p => new Date(p.date).getTime());
    const ys = dailyMax.map(p => p.one_rm);
    let current = ys[ys.length - 1];
    let line = null;
    if (xs.length > 2) {
      line = loess(xs, ys, 0.08);
      current = line[line.length - 1][1];
    }
    const best = Math.max(...ys);
    let change30 = null;
    if (line && xs[xs.length - 1] - xs[0] >= 21 * MS_PER_DAY) {
      const cutoff = xs[xs.length - 1] - 30 * MS_PER_DAY;
      let idx = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i][0] <= cutoff) idx = i;
      }
      change30 = current - line[idx][1];
    }
    return { current, best, change30 };
  }, [allSets]);

  // Sessions count within the selected time range
  const sessionsCount = useMemo(() => {
    if (!filteredSets.length) return 0;
    return new Set(filteredSets.map(s => s.date.slice(0, 10))).size;
  }, [filteredSets]);

  // Volume per session (sum of weight × reps per date) for filtered range
  const volumeData = useMemo(() => {
    if (!filteredSets.length) return [];
    const byDate = {};
    filteredSets.forEach(s => {
      const key = s.date.slice(0, 10);
      byDate[key] = (byDate[key] || 0) + s.weight * s.reps;
    });
    return Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, vol]) => [new Date(date).getTime(), Math.round(vol)]);
  }, [filteredSets]);

  const weeklySetsFiltered = useMemo(() => {
    if (!weeklySetsData.length || !rangeStart) return weeklySetsData;
    return weeklySetsData.filter((row) => {
      if (!row.week) return false;
      try {
        return isoWeekToDate(row.week) >= rangeStart;
      } catch {
        return false;
      }
    });
  }, [weeklySetsData, rangeStart]);

  const scatterData = useMemo(() =>
    filteredDailyMaxPoints.map(pt => [
      new Date(pt.date).getTime(),
      pt.one_rm,
    ]), [filteredDailyMaxPoints]
  );

  const loessLine = useMemo(() => {
    if (scatterData.length > 2) {
      const xs = scatterData.map(d => d[0]);
      const ys = scatterData.map(d => d[1]);
      return loess(xs, ys, 0.08);
    }
    return [];
  }, [scatterData]);

  // PR point — highest 1RM in the filtered view
  const prPoint = useMemo(() => {
    if (!scatterData.length) return null;
    return scatterData.reduce((best, pt) => (pt[1] > best[1] ? pt : best), scatterData[0]);
  }, [scatterData]);

  const goalSeries = useMemo(() => {
    if (!activeGoal) return null;
    return [
      [new Date(activeGoal.start_date).getTime(), activeGoal.start_one_rm],
      [new Date(activeGoal.target_date).getTime(), activeGoal.target_one_rm],
    ];
  }, [activeGoal]);

  const chartOptions = {
    chart: {
      type: 'scatter',
      zoomType: 'xy',
      backgroundColor: 'transparent',
      style: { fontFamily: 'inherit' },
      height: 280,
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
      softMin: scatterData.length
        ? Math.floor(Math.min(...scatterData.map(d => d[1])) * 0.92)
        : undefined,
      labels: {
        format: '{value} kg',
        style: { fontSize: '11px', color: chartText },
      },
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
      scatter: {
        marker: {
          radius: 3.5,
          fillColor: 'rgba(0, 212, 170, 0.55)',
          lineWidth: 0,
        },
        states: { hover: { enabled: true } },
      },
    },
    series: [
      {
        name: 'Daily max 1RM',
        data: scatterData,
        type: 'scatter',
      },
      {
        name: 'Trend',
        data: loessLine,
        type: 'area',
        color: '#00d4aa',
        lineWidth: 2.5,
        // Area series default to threshold 0, which forces the y-axis to include
        // zero and squashes the actual 1RM range into a sliver at the top. null
        // fills to the axis minimum instead, letting softMin above do its job.
        threshold: null,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, 'rgba(0, 212, 170, 0.14)'],
            [1, 'rgba(0, 212, 170, 0)'],
          ],
        },
        marker: { enabled: false },
        enableMouseTracking: false,
      },
      {
        name: 'PR',
        data: prPoint ? [prPoint] : [],
        type: 'scatter',
        marker: {
          radius: 6,
          symbol: 'diamond',
          fillColor: '#facc15',
          lineWidth: 0,
        },
        zIndex: 5,
      },
      ...(goalSeries ? [{
        name: 'Goal',
        data: goalSeries,
        type: 'line',
        color: chartText,
        lineWidth: 2,
        dashStyle: 'Dash',
        marker: { enabled: true, radius: 3, symbol: 'circle', fillColor: 'transparent', lineColor: chartText, lineWidth: 2 },
      }] : []),
    ],
    credits: { enabled: false },
  };

  let weeklySetsChartOptions = null;
  if (weeklySetsFiltered.length > 0 && muscleGroup) {
    const weekLabels = weeklySetsFiltered.map(row => {
      try { return format(isoWeekToDate(row.week), 'd MMM'); } catch { return row.week; }
    });
    const sets = weeklySetsFiltered.map(row => parseInt(row.total_sets, 10));
    const optimal = OPTIMAL_RANGES[muscleGroup];
    let minOpt = 0, maxOpt = 0;
    if (optimal && optimal.sets) {
      const match = optimal.sets.match(/(\d+)[^\d]+(\d+)/);
      if (match) {
        minOpt = parseInt(match[1], 10);
        maxOpt = parseInt(match[2], 10);
      }
    }

    weeklySetsChartOptions = {
      chart: {
        type: 'column',
        backgroundColor: 'transparent',
        style: { fontFamily: 'inherit' },
        height: 260,
        spacing: [8, 4, 8, 4],
      },
      title: { text: '' },
      xAxis: {
        categories: weekLabels,
        title: { text: null },
        lineColor: axisColor,
        tickColor: 'transparent',
        labels: { style: { fontSize: '10px', color: chartText } },
      },
      yAxis: {
        min: 0,
        title: { text: null },
        gridLineColor: gridColor,
        plotBands: minOpt && maxOpt ? [{
          from: minOpt,
          to: maxOpt,
          color: 'rgba(0, 212, 170, 0.08)',
          label: {
            text: `Optimal ${minOpt}–${maxOpt}`,
            style: { color: '#5DCAA5', fontSize: '10px', fontWeight: '500' },
          }
        }] : [],
        labels: { style: { fontSize: '11px', color: chartText } },
      },
      tooltip: { ...tooltipStyle, valueSuffix: ' sets' },
      plotOptions: {
        column: { borderWidth: 0, borderRadius: 3 },
      },
      series: [{ name: muscleGroup, data: sets, color: 'rgba(0, 212, 170, 0.8)' }],
      credits: { enabled: false },
      legend: { enabled: false },
    };
  }

  const groupedExercises = exercises.reduce((groups, ex) => {
    if (!groups[ex.muscle_group]) groups[ex.muscle_group] = [];
    groups[ex.muscle_group].push(ex);
    return groups;
  }, {});

  const exerciseGroups = Object.entries(groupedExercises).map(([group, items]) => ({
    label: group,
    items,
  }));

  const sortedSets = useMemo(() =>
    filteredSets.slice().sort((a, b) => b.date.localeCompare(a.date)),
    [filteredSets]
  );

  const groupedSets = useMemo(() => {
    const setsToShow = showAllSets ? sortedSets : sortedSets.slice(0, SETS_PREVIEW);
    const groups = {};
    setsToShow.forEach(set => {
      const key = set.date.slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(set);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sortedSets, showAllSets]);

  // ── Mobility ─────────────────────────────────────────────────────────────
  // Mobility work has no weight or reps, so there is no 1RM to chart. What
  // matters instead is whether it is being done, and for how long.
  const selectedInfo = useMemo(
    () => exercises.find(e => e.id === parseInt(selectedExercise, 10)) || null,
    [exercises, selectedExercise]
  );
  const isMobility = selectedInfo?.category === 'mobility';
  const isTimed = isMobility && selectedInfo?.tracking_type !== 'checkoff';

  const mobility = useMemo(() => {
    if (!isMobility) return null;
    const bySession = (rows) => {
      const acc = {};
      rows.forEach(r => {
        const key = r.date.slice(0, 10);
        if (!acc[key]) acc[key] = { sets: 0, seconds: 0 };
        acc[key].sets += 1;
        acc[key].seconds += r.duration_seconds || 0;
      });
      return acc;
    };
    const inRange = bySession(filteredSets);
    const all = bySession(allSets);
    const dates = Object.keys(inRange).sort();

    // Consecutive weeks with at least one session, counting back from this
    // week — or from last week, so the streak isn't shown as broken just
    // because this week's session hasn't happened yet.
    const weeks = new Set(Object.keys(all).map(d => format(startOfISOWeek(parseISO(d)), 'yyyy-MM-dd')));
    let cursor = startOfISOWeek(new Date());
    if (!weeks.has(format(cursor, 'yyyy-MM-dd'))) cursor = subWeeks(cursor, 1);
    let streak = 0;
    while (weeks.has(format(cursor, 'yyyy-MM-dd'))) { streak += 1; cursor = subWeeks(cursor, 1); }

    return {
      sessions: dates.length,
      totalSets: dates.reduce((n, d) => n + inRange[d].sets, 0),
      totalSeconds: dates.reduce((n, d) => n + inRange[d].seconds, 0),
      longest: allSets.reduce((m, r) => Math.max(m, r.duration_seconds || 0), 0),
      streak,
      series: dates.map(d => [new Date(d).getTime(), isTimed ? inRange[d].seconds : inRange[d].sets]),
    };
  }, [isMobility, isTimed, filteredSets, allSets]);

  const fmtHold = (secs) => {
    if (!secs) return '0s';
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60), r = secs % 60;
    return r ? `${m}:${String(r).padStart(2, '0')}` : `${m}m`;
  };

  const rangeLabel = { '3m': '3 months', '6m': '6 months', '1y': '1 year', 'all': 'all time' }[timeRange];

  return (
    <Box sx={pageSx}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Panel sx={{ p: 1.25 }}>
          <ScrollablePicker
            items={exerciseGroups}
            value={selectedExercise}
            onChange={setSelectedExercise}
            label="Select an exercise"
            grouped
            getGroupLabel={(g) => g.label}
            searchEnabled
            searchPlaceholder="Search exercises..."
            inputBackground="rgba(255,255,255,0.03)"
            buttonHeight={42}
          />
          <Box
            role="tablist"
            sx={{ display: 'flex', mt: 1, p: '3px', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {[['3m', '3 mo'], ['6m', '6 mo'], ['1y', '1 yr'], ['all', 'All']].map(([key, label]) => {
              const on = timeRange === key;
              return (
                <Box
                  key={key}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTimeRange(key)}
                  sx={{
                    flex: 1, textAlign: 'center', py: 0.875, borderRadius: 1.5, cursor: 'pointer', userSelect: 'none',
                    fontSize: 12, fontWeight: 700,
                    color: on ? '#06140F' : 'rgba(255,255,255,0.55)',
                    backgroundColor: on ? TEAL : 'transparent',
                    transition: 'background-color .18s ease, color .18s ease',
                  }}
                >
                  {label}
                </Box>
              );
            })}
          </Box>
        </Panel>

        {loading ? (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={58} sx={{ borderRadius: 3 }} />)}
            </Box>
            <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} />
          </>
        ) : error ? (
          <Panel sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>{error}</Typography>
            <Button
              variant="outlined" size="small" sx={{ fontSize: 12.5, textTransform: 'none' }}
              onClick={() => (selectedExercise ? fetchPerformanceData(selectedExercise) : fetchExercises())}
            >
              Retry
            </Button>
          </Panel>
        ) : !selectedExercise ? (
          <Panel sx={{ py: 5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Pick an exercise to see your progress</Typography>
          </Panel>
        ) : isMobility ? (
          !mobility || mobility.sessions === 0 ? (
            <Panel sx={{ py: 5, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                {allSets.length === 0 ? 'Nothing logged for this exercise yet' : `Nothing logged in the last ${rangeLabel}`}
              </Typography>
            </Panel>
          ) : (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                <StatCard label="Sessions" value={mobility.sessions} unit={`in ${rangeLabel}`} accent={MOBILITY_PINK} />
                <StatCard label="Week streak" value={mobility.streak} unit={mobility.streak === 1 ? 'week' : 'weeks'} />
                {isTimed ? (
                  <>
                    <StatCard label="Total hold time" value={fmtHold(mobility.totalSeconds)} />
                    <StatCard label="Longest hold" value={fmtHold(mobility.longest)} />
                  </>
                ) : (
                  <>
                    <StatCard label="Times completed" value={mobility.totalSets} />
                    <StatCard label="Per session" value={(mobility.totalSets / mobility.sessions).toFixed(1)} unit="avg" />
                  </>
                )}
              </Box>

              {mobility.series.length > 1 && (
                <Panel sx={{ pb: 0.5 }}>
                  <PanelLabel>{isTimed ? 'Hold time per session' : 'Completions per session'}</PanelLabel>
                  <HighchartsReact highcharts={Highcharts} options={{
                    chart: { type: 'column', backgroundColor: 'transparent', style: { fontFamily: 'inherit' }, height: 200, spacing: [8, 4, 8, 4] },
                    title: { text: '' },
                    xAxis: { type: 'datetime', title: { text: null }, lineColor: axisColor, tickColor: 'transparent', gridLineWidth: 0, labels: { style: { fontSize: '11px', color: chartText } } },
                    yAxis: {
                      min: 0, title: { text: null }, gridLineColor: gridColor, allowDecimals: false,
                      labels: { formatter: function () { return isTimed ? `${this.value}s` : this.value; }, style: { fontSize: '11px', color: chartText } },
                    },
                    tooltip: {
                      ...tooltipStyle,
                      formatter: function () {
                        return `<b>${format(new Date(this.x), 'MMM d, yyyy')}</b><br/>${isTimed ? `Held <b>${fmtHold(this.y)}</b>` : `<b>${this.y}</b> completed`}`;
                      },
                    },
                    plotOptions: { column: { borderWidth: 0, borderRadius: 3, pointPadding: 0.05, groupPadding: 0.1, maxPointWidth: 28 } },
                    series: [{ name: 'Mobility', data: mobility.series, color: `${MOBILITY_PINK}cc` }],
                    credits: { enabled: false },
                    legend: { enabled: false },
                  }} />
                </Panel>
              )}

              <Panel>
                <PanelLabel
                  right={<Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>{sortedSets.length} logged</Typography>}
                >
                  Log
                </PanelLabel>
                {groupedSets.map(([date, dateSets]) => (
                  <Box key={date} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, py: 0.375 }}>
                    <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                      {format(parseISO(date), 'EEE d MMM yyyy')}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {isTimed
                        ? dateSets.map(r => fmtHold(r.duration_seconds || 0)).join('  ·  ')
                        : `${dateSets.length} × done`}
                    </Typography>
                  </Box>
                ))}
                {sortedSets.length > SETS_PREVIEW && (
                  <Button onClick={() => setShowAllSets(v => !v)} fullWidth sx={{ mt: 0.5, fontSize: 12, textTransform: 'none', color: 'rgba(255,255,255,0.55)' }}>
                    {showAllSets ? 'Show fewer' : `Show all ${sortedSets.length}`}
                  </Button>
                )}
              </Panel>
            </>
          )
        ) : filteredDailyMaxPoints.length === 0 ? (
          <Panel sx={{ py: 5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              {allSets.length === 0 ? 'No sets logged for this exercise yet' : `Nothing logged in the last ${rangeLabel}`}
            </Typography>
          </Panel>
        ) : (
          <>
            {headline && (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                <StatCard label="Est. 1RM" value={headline.current.toFixed(1)} unit="kg" accent={TEAL} />
                <StatCard label="All-time best" value={headline.best.toFixed(1)} unit="kg" />
                <StatCard
                  label="30 day change"
                  value={headline.change30 == null ? '—' : `${headline.change30 >= 0 ? '+' : ''}${headline.change30.toFixed(1)}`}
                  unit={headline.change30 == null ? '' : 'kg'}
                  accent={headline.change30 == null ? undefined : headline.change30 >= 0 ? TEAL : DANGER}
                />
                <StatCard label="Sessions" value={sessionsCount} unit={`in ${rangeLabel}`} />
              </Box>
            )}

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
                  Goal · {Math.max(0, differenceInCalendarDays(parseISO(activeGoal.target_date), new Date()))}d left
                </PanelLabel>
                <Box sx={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', mb: 1 }}>
                  <Box sx={{ height: '100%', borderRadius: 3, width: `${Math.min(100, activeGoal.progress * 100)}%`, background: `linear-gradient(90deg, ${TEAL}99 0%, ${TEAL} 100%)`, transition: 'width 0.4s ease' }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    <Box component="span" sx={{ color: TEAL, fontWeight: 700 }}>{activeGoal.current_one_rm} kg</Box>
                    {' → '}
                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{activeGoal.target_one_rm} kg</Box>
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    by {format(parseISO(activeGoal.target_date), 'd MMM yyyy')}
                  </Typography>
                </Box>
              </Panel>
            )}

            <Panel sx={{ pb: 0.5 }}>
              <PanelLabel
                right={
                  <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 14, height: 2, backgroundColor: TEAL, borderRadius: 1 }} />
                      <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)' }}>trend</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 7, height: 7, backgroundColor: '#facc15', transform: 'rotate(45deg)' }} />
                      <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)' }}>best</Typography>
                    </Box>
                    {activeGoal && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 14, height: 0, borderTop: '2px dashed rgba(255,255,255,0.45)' }} />
                        <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)' }}>goal</Typography>
                      </Box>
                    )}
                  </Box>
                }
              >
                Estimated 1RM
              </PanelLabel>
              <HighchartsReact highcharts={Highcharts} options={chartOptions} />
            </Panel>

            {weeklySetsChartOptions && (
              <Panel sx={{ pb: 0.5 }}>
                <PanelLabel>Weekly sets · {muscleGroup}</PanelLabel>
                <HighchartsReact highcharts={Highcharts} options={weeklySetsChartOptions} />
              </Panel>
            )}

            {volumeData.length > 1 && (
              <Panel sx={{ pb: 0.5 }}>
                <PanelLabel>Session volume</PanelLabel>
              <HighchartsReact highcharts={Highcharts} options={{
                chart: {
                  type: 'column',
                  backgroundColor: 'transparent',
                  style: { fontFamily: 'inherit' },
                  height: 220,
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
                  min: 0,
                  title: { text: null },
                  gridLineColor: gridColor,
                  labels: {
                    formatter: function () { return this.value >= 1000 ? `${(this.value / 1000).toFixed(1)}k` : this.value; },
                    style: { fontSize: '11px', color: chartText },
                  },
                },
                tooltip: {
                  ...tooltipStyle,
                  formatter: function () {
                    return `<b>${format(new Date(this.x), 'MMM d, yyyy')}</b><br/>Volume: <b>${this.y.toLocaleString()} kg</b>`;
                  },
                },
                plotOptions: {
                  column: { borderWidth: 0, borderRadius: 3, pointPadding: 0.05, groupPadding: 0 },
                },
                series: [{
                  name: 'Volume',
                  data: volumeData,
                  color: 'rgba(0, 212, 170, 0.45)',
                }],
                credits: { enabled: false },
                legend: { enabled: false },
              }} />
              </Panel>
            )}

            <Panel>
              <PanelLabel
                right={<Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>{sortedSets.length} sets</Typography>}
              >
                Logged sets
              </PanelLabel>
              {groupedSets.map(([date, dateSets]) => (
                <Box key={date} sx={{ mb: 0.75 }}>
                  <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', mb: 0.25 }}>
                    {format(parseISO(date), 'EEE d MMM yyyy')}
                  </Typography>
                  {dateSets.map((row, idx) => (
                    <Box
                      key={`${row.set_number}-${idx}`}
                      sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.375, fontVariantNumeric: 'tabular-nums' }}
                    >
                      <Typography sx={{ fontSize: 13 }}>{row.weight} kg × {row.reps}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>
                        {calc1RM(row.weight, row.reps).toFixed(1)} kg 1RM
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ))}
              {sortedSets.length > SETS_PREVIEW && (
                <Button
                  onClick={() => setShowAllSets(v => !v)}
                  fullWidth
                  sx={{ mt: 0.5, fontSize: 12, textTransform: 'none', color: 'rgba(255,255,255,0.55)' }}
                >
                  {showAllSets ? 'Show fewer' : `Show all ${sortedSets.length} sets`}
                </Button>
              )}
            </Panel>
          </>
        )}
      </Box>
    </Box>
  );
};

export default Performance;
