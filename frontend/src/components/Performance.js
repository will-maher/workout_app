import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  ButtonGroup,
  Alert,
  Skeleton,
  Chip,
} from '@mui/material';
import ScrollablePicker from './ScrollablePicker';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import axios from 'axios';
import { format, parseISO, startOfISOWeek, subMonths, subYears, differenceInCalendarDays } from 'date-fns';
import { OPTIMAL_RANGES } from './WorkoutPlanner';
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

  useEffect(() => {
    fetchExercises();
    axios.get(`${API_BASE_URL}/api/goals`)
      .then(res => setGoals(Array.isArray(res.data) ? res.data : []))
      .catch(() => setGoals([]));
  }, []);

  useEffect(() => {
    setShowAllSets(false);
    if (selectedExercise) {
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
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/exercises`);
      const list = Array.isArray(res.data) ? res.data : [];
      setExercises(list);
      const bench = list.find(e => e.name.toLowerCase().includes('barbell bench press'));
      if (bench) setSelectedExercise(bench.id);
    } catch (err) {
      console.error('Error loading exercises:', err);
      setError('Failed to load exercises');
      setExercises([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformanceData = async (exerciseId) => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get(`${API_BASE_URL}/api/stats/performance/sets?exercise_id=${exerciseId}`);
      setAllSets(res.data);
    } catch (err) {
      console.error('Error fetching performance data:', err);
      setError('Failed to load performance data');
      setAllSets([]);
    } finally {
      setLoading(false);
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
    const setsToShow = showAllSets ? sortedSets : sortedSets.slice(0, 30);
    const groups = {};
    setsToShow.forEach(set => {
      const key = set.date.slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(set);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sortedSets, showAllSets]);

  const sectionTitleSx = {
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'text.secondary',
    mb: 1,
  };

  const rangeLabel = { '3m': '3 months', '6m': '6 months', '1y': '1 year', 'all': 'all time' }[timeRange];

  return (
    <Box maxWidth={600} mx="auto" mt={2} px={{ xs: 1.5, sm: 0 }}>
      <Box sx={{ mb: 2 }}>
        <ScrollablePicker
          items={exerciseGroups}
          value={selectedExercise}
          onChange={setSelectedExercise}
          label="Select Exercise"
          grouped
          getGroupLabel={(g) => g.label}
          searchEnabled
          searchPlaceholder="Search exercises..."
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <ButtonGroup size="small" variant="outlined" fullWidth>
          {[['3m', '3 mo'], ['6m', '6 mo'], ['1y', '1 yr'], ['all', 'All']].map(([key, label]) => (
            <Button
              key={key}
              variant={timeRange === key ? 'contained' : 'outlined'}
              onClick={() => setTimeRange(key)}
              sx={{ flex: 1, fontSize: 12 }}
            >
              {label}
            </Button>
          ))}
        </ButtonGroup>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
            <Skeleton variant="rounded" height={64} />
            <Skeleton variant="rounded" height={64} />
            <Skeleton variant="rounded" height={64} />
            <Skeleton variant="rounded" height={64} />
          </Box>
          <Skeleton variant="rounded" height={300} />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : !selectedExercise ? (
        <Typography color="text.secondary" align="center" py={6} sx={{ fontSize: 13 }}>
          Pick an exercise to see your progress
        </Typography>
      ) : filteredDailyMaxPoints.length === 0 ? (
        <Typography color="text.secondary" align="center" py={6} sx={{ fontSize: 13 }}>
          No data for this exercise in the last {rangeLabel}
        </Typography>
      ) : (
        <>
          {headline && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 2 }}>
              <StatCard label="Est. 1RM" value={headline.current.toFixed(1)} unit="kg" accent="primary.main" />
              <StatCard label="All-time best" value={headline.best.toFixed(1)} unit="kg" />
              <StatCard
                label="30d change"
                value={headline.change30 == null ? '—' : `${headline.change30 >= 0 ? '+' : ''}${headline.change30.toFixed(1)}`}
                unit={headline.change30 == null ? '' : 'kg'}
                accent={headline.change30 == null ? 'text.secondary' : headline.change30 >= 0 ? 'primary.main' : '#F09595'}
              />
              <StatCard label="Sessions" value={sessionsCount} unit={rangeLabel} />
            </Box>
          )}

          {activeGoal && (
            <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'text.secondary' }}>
                  Goal · {Math.max(0, differenceInCalendarDays(parseISO(activeGoal.target_date), new Date()))}d left
                </Typography>
                <Chip
                  label={activeGoal.achieved ? 'achieved' : activeGoal.on_track ? 'on track' : 'behind'}
                  size="small"
                  sx={{
                    fontSize: 10,
                    height: 18,
                    fontWeight: 600,
                    color: '#04342C',
                    backgroundColor: activeGoal.achieved ? '#9FE1CB' : activeGoal.on_track ? '#5DCAA5' : '#FAC775',
                  }}
                />
              </Box>
              <Box sx={{ height: 4, borderRadius: 2, backgroundColor: 'divider', mb: 1 }}>
                <Box sx={{ height: '100%', borderRadius: 2, width: `${activeGoal.progress * 100}%`, backgroundColor: 'primary.main', transition: 'width 0.4s ease' }} />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{activeGoal.current_one_rm} kg</Box>
                  {' → '}
                  <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{activeGoal.target_one_rm} kg</Box>
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  by {format(parseISO(activeGoal.target_date), 'd MMM yyyy')}
                </Typography>
              </Box>
            </Box>
          )}

          <HighchartsReact highcharts={Highcharts} options={chartOptions} />

          {weeklySetsChartOptions && (
            <Box mt={3}>
              <Typography sx={sectionTitleSx}>
                Weekly sets — {muscleGroup}
              </Typography>
              <HighchartsReact highcharts={Highcharts} options={weeklySetsChartOptions} />
            </Box>
          )}

          {volumeData.length > 1 && (
            <Box mt={3}>
              <Typography sx={sectionTitleSx}>Session volume</Typography>
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
                  color: 'rgba(99, 102, 241, 0.75)',
                }],
                credits: { enabled: false },
                legend: { enabled: false },
              }} />
            </Box>
          )}

          <Box mt={3}>
            <Typography sx={sectionTitleSx}>
              Logged sets
            </Typography>
            <Box>
              {groupedSets.map(([date, dateSets]) => (
                <Box key={date}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                    {format(parseISO(date), 'd MMM yyyy')}
                  </Typography>
                  {dateSets.map((row, idx) => (
                    <Box
                      key={`${row.set_number}-${idx}`}
                      sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <Typography sx={{ fontSize: 13 }}>
                        {row.weight} kg × {row.reps}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {calc1RM(row.weight, row.reps).toFixed(1)} kg 1RM
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
            {sortedSets.length > 30 && (
              <Button
                size="small"
                onClick={() => setShowAllSets(v => !v)}
                sx={{ mt: 1, fontSize: 12, color: 'text.secondary' }}
                fullWidth
              >
                {showAllSets ? 'Show less' : `Show all ${sortedSets.length} sets`}
              </Button>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

export default Performance;
