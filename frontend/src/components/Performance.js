import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { OPTIMAL_RANGES } from './WorkoutPlanner';

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
  const [dailyMaxPoints, setDailyMaxPoints] = useState([]);
  const [allSets, setAllSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [weeklySetsData, setWeeklySetsData] = useState([]);
  const [muscleGroup, setMuscleGroup] = useState('');

  useEffect(() => {
    fetchExercises();
  }, []);

  useEffect(() => {
    if (selectedExercise) fetchPerformanceData(selectedExercise);
    else {
      setDailyMaxPoints([]);
      setAllSets([]);
    }
  }, [selectedExercise]);

  useEffect(() => {
    if (selectedExercise && exercises.length > 0) {
      const ex = exercises.find(e => e.id === selectedExercise);
      setMuscleGroup(ex?.muscle_group || '');
    } else {
      setMuscleGroup('');
    }
  }, [selectedExercise, exercises]);

  useEffect(() => {
    if (muscleGroup) {
      fetchWeeklySetsData();
    } else {
      setWeeklySetsData([]);
    }
    async function fetchWeeklySetsData() {
      try {
        const res = await axios.get('/api/stats/weekly-sets-by-muscle-group');
        // Filter for the selected muscle group
        setWeeklySetsData(res.data.filter(row => row.muscle_group === muscleGroup));
      } catch (err) {
        setWeeklySetsData([]);
      }
    }
  }, [muscleGroup]);

  const fetchExercises = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/exercises');
      // Ensure exercises is always an array
      setExercises(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error loading exercises:', err);
      setError('Failed to load exercises');
      setExercises([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformanceData = async (exerciseId) => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get(`/api/stats/performance/sets?exercise_id=${exerciseId}`);
      setAllSets(res.data);
      // Calculate 1RM for each set
      const points = res.data.map(set => ({
        date: set.date,
        one_rm: calc1RM(set.weight, set.reps),
      }));
      // Get daily max 1RM (unique per day, highest value)
      const dailyMax = getDailyMax1RM(points);
      setDailyMaxPoints(dailyMax);
    } catch (err) {
      setError('Failed to load performance data');
      setDailyMaxPoints([]);
      setAllSets([]);
    } finally {
      setLoading(false);
    }
  };

  // Prepare data for Highcharts scatter plot
  const scatterData = dailyMaxPoints.map(pt => [
    new Date(pt.date).getTime(),
    pt.one_rm
  ]);

  // Calculate LOESS smoothed line
  let loessLine = [];
  if (scatterData.length > 2) {
    const xs = scatterData.map(d => d[0]);
    const ys = scatterData.map(d => d[1]);
    loessLine = loess(xs, ys, 0.08); // 0.08 = more variation
  }

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
      title: { text: null }, // Remove the x-axis label
      labels: { style: { fontSize: '14px' } },
    },
    yAxis: {
      title: { text: '1RM (kg)' },
      min: 0,
      labels: { style: { fontSize: '14px' } },
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
          fillColor: 'rgba(255, 152, 0, 0.6)',
          lineColor: '#fff',
          lineWidth: 1,
        },
        states: {
          hover: {
            enabled: true,
            lineColor: '#2196f3',
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
        color: '#2196f3',
        lineWidth: 3,
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
          xAxis: { labels: { style: { fontSize: '11px' } } },
          yAxis: { labels: { style: { fontSize: '11px' } } },
        },
      }],
    },
  };

  // --- Weekly Sets Chart ---
  let weeklySetsChartOptions = null;
  if (weeklySetsData.length > 0 && muscleGroup) {
    const weeks = weeklySetsData.map(row => row.week);
    const sets = weeklySetsData.map(row => parseInt(row.total_sets, 10));
    // Get optimal range for this muscle group
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
      chart: { type: 'column', backgroundColor: 'transparent', style: { fontFamily: 'inherit' } },
      title: { text: '' },
      xAxis: { categories: weeks, title: { text: 'Week' }, labels: { style: { fontSize: '14px' } } },
      yAxis: {
        min: 0,
        title: { text: 'Sets per Week' },
        plotBands: minOpt && maxOpt ? [{
          from: minOpt,
          to: maxOpt,
          color: 'rgba(76, 175, 80, 0.15)',
          label: { text: `Optimal: ${minOpt}-${maxOpt}`, style: { color: '#388e3c', fontWeight: 600 } }
        }] : [],
        labels: { style: { fontSize: '14px' } },
      },
      tooltip: { valueSuffix: ' sets', style: { fontSize: '15px' } },
      series: [{ name: muscleGroup, data: sets, color: '#2196f3' }],
      credits: { enabled: false },
      legend: { enabled: false },
      responsive: { rules: [{ condition: { maxWidth: 600 }, chartOptions: { chart: { height: 300 }, xAxis: { labels: { style: { fontSize: '11px' } } }, yAxis: { labels: { style: { fontSize: '11px' } } } } }] },
    };
  }

  return (
    <Box maxWidth={600} mx="auto" mt={4}>
      <Typography variant="h4" fontWeight={700} gutterBottom align="center">
        Performance vTEST123
      </Typography>
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Exercise</InputLabel>
            <Select
              value={selectedExercise}
              onChange={e => setSelectedExercise(e.target.value)}
              label="Exercise"
            >
              {Array.isArray(exercises) && exercises.map(ex => (
                <MenuItem key={ex.id} value={ex.id}>{ex.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : dailyMaxPoints.length === 0 ? (
            <Typography color="text.secondary" align="center" py={4}>
              No data for this exercise
            </Typography>
          ) : (
            <>
              <HighchartsReact highcharts={Highcharts} options={chartOptions} />
              {/* --- New Weekly Sets Chart --- */}
              {weeklySetsChartOptions && (
                <Box mt={4}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Weekly Sets for {muscleGroup}
                  </Typography>
                  <HighchartsReact highcharts={Highcharts} options={weeklySetsChartOptions} />
                </Box>
              )}
              {/* Table of all sets */}
              <Box mt={4}>
                <Typography variant="h6" fontWeight={600} gutterBottom>All Logged Sets</Typography>
                <TableContainer component={Paper}>
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
                      {allSets.slice().sort((a, b) => b.date.localeCompare(a.date)).map((row, idx) => (
                        <TableRow key={row.date + '-' + row.set_number + '-' + idx}>
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