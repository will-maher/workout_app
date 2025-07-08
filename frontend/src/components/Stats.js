import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import axios from 'axios';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { format, parseISO, getISOWeek, getYear, startOfISOWeek } from 'date-fns';

const LIFT_CONFIG = [
  { id: 1, name: 'Barbell bench press', color: '#1976d2' },
  { id: 12, name: 'Overhead press', color: '#ff9800' },
  { id: 19, name: 'Low bar squat', color: '#43a047' },
  { id: 28, name: 'Deadlift', color: '#8e24aa' },
];

const Stats = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [oneRepMaxData, setOneRepMaxData] = useState([]);
  const [volumeData, setVolumeData] = useState([]);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('');
  const [weeklySetsData, setWeeklySetsData] = useState([]);

  useEffect(() => {
    fetchWeeklySetsData();
    fetchStats();
  }, []);

  const fetchWeeklySetsData = async () => {
    try {
      const res = await axios.get('/api/stats/weekly-sets-by-muscle-group');
      setWeeklySetsData(res.data);
    } catch (err) {
      setWeeklySetsData([]);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');

      const [
        oneRepMaxResponse,
        volumeResponse,
      ] = await Promise.all([
        axios.get('/api/stats/one-rep-max'),
        axios.get('/api/stats/weekly-volume'),
      ]);

      setOneRepMaxData(oneRepMaxResponse.data);
      setVolumeData(volumeResponse.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const getMuscleGroupColor = (muscleGroup) => {
    const colors = {
      chest: '#ff6b6b',
      back: '#4ecdc4',
      legs: '#45b7d1',
      shoulders: '#96ceb4',
      arms: '#feca57',
      core: '#ff9ff3',
    };
    return colors[muscleGroup] || '#95a5a6';
  };

  const formatWeight = (weight) => `${weight.toFixed(1)} lbs`;
  const formatVolume = (volume) => `${volume.toFixed(0)} lbs`;

  // Get all unique muscle groups from weeklySetsData
  const muscleGroups = Array.from(new Set(weeklySetsData.map(row => row.muscle_group)));

  // Default to first muscle group if none selected
  useEffect(() => {
    if (muscleGroups.length > 0 && !selectedMuscleGroup) {
      setSelectedMuscleGroup(muscleGroups[0]);
    }
  }, [muscleGroups, selectedMuscleGroup]);

  // Prepare weekly sets data for the selected muscle group
  const filteredWeekly = weeklySetsData.filter(row => row.muscle_group === selectedMuscleGroup);
  const chartWeeks = filteredWeekly.map(row => {
    const [year, week] = row.week.split('-W');
    const monday = startOfISOWeek(new Date(Number(year), 0, 1 + (Number(week) - 1) * 7));
    return format(monday, 'MMM d, yyyy');
  });
  const chartSets = filteredWeekly.map(row => row.total_sets);

  const weeklySetsOptions = {
    chart: {
      type: 'column',
      backgroundColor: 'transparent',
      style: { fontFamily: 'inherit' },
      height: 350,
    },
    title: { text: '' },
    xAxis: {
      categories: chartWeeks,
      title: { text: 'Week' },
      labels: { style: { fontSize: '14px' } },
    },
    yAxis: {
      min: 0,
      title: { text: 'Sets per Week' },
      labels: { style: { fontSize: '14px' } },
    },
    legend: { enabled: false },
    tooltip: {
      formatter: function () {
        return `<b>Week of: ${this.x}</b><br/>Sets: <b>${this.y}</b>`;
      },
      style: { fontSize: '15px' },
    },
    plotOptions: {
      column: {
        borderRadius: 3,
        color: '#1976d2',
        pointPadding: 0.1,
        groupPadding: 0.05,
      },
    },
    series: [
      {
        name: 'Sets per Week',
        data: chartSets,
        type: 'column',
      },
    ],
    credits: { enabled: false },
    responsive: {
      rules: [{
        condition: { maxWidth: 600 },
        chartOptions: {
          chart: { height: 250 },
          xAxis: { labels: { style: { fontSize: '11px' } } },
          yAxis: { labels: { style: { fontSize: '11px' } } },
        },
      }],
    },
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Workout Statistics
      </Typography>

      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="Volume Analysis" />
      </Tabs>

      {/* Volume Analysis Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Weekly Sets by Muscle Group
                </Typography>
                {muscleGroups.length > 0 && (
                  <FormControl component="fieldset" sx={{ mb: 2 }}>
                    <FormLabel component="legend">Select Muscle Group</FormLabel>
                    <RadioGroup
                      row
                      value={selectedMuscleGroup}
                      onChange={e => setSelectedMuscleGroup(e.target.value)}
                    >
                      {muscleGroups.map(mg => (
                        <FormControlLabel
                          key={mg}
                          value={mg}
                          control={<Radio />}
                          label={mg}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                )}
                {filteredWeekly.length > 0 ? (
                  <HighchartsReact highcharts={Highcharts} options={weeklySetsOptions} />
                ) : (
                  <Typography color="textSecondary" align="center" py={4}>
                    No weekly sets data available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default Stats; 