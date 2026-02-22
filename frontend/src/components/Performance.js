import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  ButtonGroup,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import ScrollablePicker from './ScrollablePicker';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import axios from 'axios';
import { format, parseISO, startOfISOWeek, subMonths, subYears } from 'date-fns';
import { OPTIMAL_RANGES } from './WorkoutPlanner';
import { API_BASE_URL } from '../App';

// Utility functions
function calc1RM(weight, reps) {
  if (!weight || !reps) return 0;
  return weight / (1.0278 - 0.0278 * reps);
}

// Get largest 1RM per day (one point per date, ignore time)
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

// Simple LOESS implementation for small datasets
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

const Performance = () => {
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [allSets, setAllSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [weeklySetsData, setWeeklySetsData] = useState([]);
  const [muscleGroup, setMuscleGroup] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const sectionSx = {
    borderBottom: '1px solid',
    borderColor: 'divider',
    borderRadius: 0,
    boxShadow: 'none',
    bgcolor: 'transparent',
  };

  // Fetch exercises on component mount
  useEffect(() => {
    fetchExercises();
  }, []);

  // Fetch performance data when exercise selection changes
  useEffect(() => {
    if (selectedExercise) {
      fetchPerformanceData(selectedExercise);
    } else {
      setAllSets([]);
    }
  }, [selectedExercise]);

  // Update muscle group when exercise changes
  useEffect(() => {
    if (selectedExercise && exercises.length > 0) {
      const ex = exercises.find(e => e.id === selectedExercise);
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

  // Fetch weekly sets data when muscle group changes
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
      setExercises(Array.isArray(res.data) ? res.data : []);
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

  const weeklySetsFiltered = useMemo(() => {
    if (!weeklySetsData.length || !rangeStart) return weeklySetsData;
    return weeklySetsData.filter((row) => {
      if (!row.week) return false;
      const [yearStr, weekStr] = row.week.split('-W');
      const year = Number(yearStr);
      const week = Number(weekStr);
      if (!year || !week) return false;
      const jan4 = new Date(year, 0, 4);
      const weekStart = startOfISOWeek(jan4);
      weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
      return weekStart >= rangeStart;
    });
  }, [weeklySetsData, rangeStart]);

  // Memoize expensive calculations
  const scatterData = useMemo(() => 
    filteredDailyMaxPoints.map(pt => [
      new Date(pt.date).getTime(),
      pt.one_rm
    ]), [filteredDailyMaxPoints]
  );

  // Calculate LOESS smoothed line (memoized)
  const loessLine = useMemo(() => {
    if (scatterData.length > 2) {
      const xs = scatterData.map(d => d[0]);
      const ys = scatterData.map(d => d[1]);
      return loess(xs, ys, 0.08);
    }
    return [];
  }, [scatterData]);

  const chartOptions = {
    chart: {
      type: 'scatter',
      zoomType: 'xy',
      backgroundColor: 'transparent',
      style: { fontFamily: 'inherit' },
    },
    title: { text: '' },
    xAxis: {
      type: 'datetime',
      title: { text: null },
      labels: { 
        style: { 
          fontSize: '14px',
          color: '#ffffff'
        } 
      },
    },
    yAxis: {
      title: { text: '1RM (kg)' },
      min: 0,
      labels: { 
        style: { 
          fontSize: '14px',
          color: '#ffffff'
        } 
      },
    },
    legend: { enabled: false },
    tooltip: {
      formatter: function () {
        return `<b>${format(parseISO(new Date(this.x).toISOString()), 'MMM d, yyyy')}</b><br/>1RM: <b>${this.y.toFixed(1)} kg</b>`;
      },
      style: { fontSize: '15px' },
    },
    plotOptions: {
      scatter: {
        marker: {
          radius: 4,
          fillColor: '#00d4aa',
          lineColor: '#ffffff',
          lineWidth: 1,
        },
        states: {
          hover: {
            enabled: true,
            lineColor: '#00d4aa',
          },
        },
      },
    },
    series: [
      {
        name: 'Daily Max 1RM',
        data: scatterData,
        type: 'scatter',
      },
      {
        name: 'LOESS Smoothed',
        data: loessLine,
        type: 'line',
        color: '#ff6b35',
        lineWidth: 4,
        marker: { enabled: false },
        enableMouseTracking: false,
        tooltip: { enabled: false },
      },
    ],
    credits: { enabled: false },
    responsive: {
      rules: [{
        condition: { maxWidth: 600 },
        chartOptions: {
          chart: { height: 350 },
          xAxis: { labels: { style: { fontSize: '11px', color: '#ffffff' } } },
          yAxis: { labels: { style: { fontSize: '11px', color: '#ffffff' } } },
        },
      }],
    },
  };

  // Weekly Sets Chart configuration
  let weeklySetsChartOptions = null;
  if (weeklySetsFiltered.length > 0 && muscleGroup) {
    const weeks = weeklySetsFiltered.map(row => row.week);
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
        style: { fontFamily: 'inherit' } 
      },
      title: { text: '' },
      xAxis: { 
        categories: weeks, 
        title: { text: 'Week' }, 
        labels: { 
          style: { 
            fontSize: '14px',
            color: '#ffffff'
          } 
        } 
      },
      yAxis: {
        min: 0,
        title: { text: 'Sets per Week' },
        plotBands: minOpt && maxOpt ? [{
          from: minOpt,
          to: maxOpt,
          color: 'rgba(0, 212, 170, 0.15)',
          label: { 
            text: `Optimal: ${minOpt}-${maxOpt}`, 
            style: { color: '#00d4aa', fontWeight: 600 } 
          }
        }] : [],
        labels: { 
          style: { 
            fontSize: '14px',
            color: '#ffffff'
          } 
        },
      },
      tooltip: { valueSuffix: ' sets', style: { fontSize: '15px' } },
      series: [{ name: muscleGroup, data: sets, color: '#00d4aa' }],
      credits: { enabled: false },
      legend: { enabled: false },
      responsive: { 
        rules: [{ 
          condition: { maxWidth: 600 }, 
          chartOptions: { 
            chart: { height: 300 }, 
            xAxis: { labels: { style: { fontSize: '11px', color: '#ffffff' } } }, 
            yAxis: { labels: { style: { fontSize: '11px', color: '#ffffff' } } } 
          } 
        }] 
      },
    };
  }

  // Group exercises by muscle group for the dropdown
  const groupedExercises = exercises.reduce((groups, ex) => {
    if (!groups[ex.muscle_group]) groups[ex.muscle_group] = [];
    groups[ex.muscle_group].push(ex);
    return groups;
  }, {});

  const exerciseGroups = Object.entries(groupedExercises).map(([group, items]) => ({
    label: group,
    items,
  }));

  return (
    <Box maxWidth={600} mx="auto" mt={2} px={{ xs: 1.5, sm: 0 }} sx={{ '& .MuiTypography-root': { fontSize: 13 } }}>
      <Typography variant="h4" fontWeight={700} gutterBottom align="center" sx={{ fontSize: 13 }}>
        Performance
      </Typography>
      <Card sx={{ ...sectionSx, mb: 2 }}>
        <CardContent>
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
            <ButtonGroup size="small" variant="outlined" fullWidth sx={{ width: '100%' }}>
              <Button
                variant={timeRange === 'all' ? 'contained' : 'outlined'}
                onClick={() => setTimeRange('all')}
                sx={{ flex: 1 }}
              >
                All
              </Button>
              <Button
                variant={timeRange === '1y' ? 'contained' : 'outlined'}
                onClick={() => setTimeRange('1y')}
                sx={{ flex: 1 }}
              >
                1 year
              </Button>
              <Button
                variant={timeRange === '6m' ? 'contained' : 'outlined'}
                onClick={() => setTimeRange('6m')}
                sx={{ flex: 1 }}
              >
                6 months
              </Button>
              <Button
                variant={timeRange === '3m' ? 'contained' : 'outlined'}
                onClick={() => setTimeRange('3m')}
                sx={{ flex: 1 }}
              >
                3 months
              </Button>
            </ButtonGroup>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : filteredDailyMaxPoints.length === 0 ? (
            <Typography color="text.secondary" align="center" py={4} sx={{ fontSize: 13 }}>
              No data for this exercise
            </Typography>
          ) : (
            <>
              <HighchartsReact highcharts={Highcharts} options={chartOptions} />
              
              {weeklySetsChartOptions && (
                <Box mt={4}>
                <Typography variant="h6" fontWeight={600} gutterBottom sx={{ fontSize: 13 }}>
                  Weekly Sets for {muscleGroup}
                </Typography>
                  <HighchartsReact highcharts={Highcharts} options={weeklySetsChartOptions} />
                </Box>
              )}
              
              <Box mt={4}>
                <Typography variant="h6" fontWeight={600} gutterBottom sx={{ fontSize: 13 }}>
                  All Logged Sets
                </Typography>
                <TableContainer component={Paper} sx={{ boxShadow: 'none', bgcolor: 'transparent', '& .MuiTableCell-root': { fontSize: 13 } }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Weight (kg)</TableCell>
                        <TableCell align="right">Reps</TableCell>
                        <TableCell align="right">1RM (kg)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredSets
                        .slice()
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((row, idx) => (
                          <TableRow key={`${row.date}-${row.set_number}-${idx}`}>
                            <TableCell>{format(parseISO(row.date), 'yyyy-MM-dd')}</TableCell>
                            <TableCell align="right">{row.weight}</TableCell>
                            <TableCell align="right">{row.reps}</TableCell>
                            <TableCell align="right">{calc1RM(row.weight, row.reps).toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Performance; 