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
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
} from '@mui/material';
import axios from 'axios';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { format, startOfISOWeek } from 'date-fns';
import { API_BASE_URL } from '../App';

const Stats = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weeklySetsData, setWeeklySetsData] = useState([]);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('');

  useEffect(() => {
    fetchWeeklySetsData();
    fetchStats();
  }, []);

  const fetchWeeklySetsData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/stats/weekly-sets-by-muscle-group`);
      // Ensure weeklySetsData is always an array
      setWeeklySetsData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error loading weekly sets data:', err);
      setWeeklySetsData([]);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');

      await Promise.all([
        axios.get(`${API_BASE_URL}/api/stats/one-rep-max`),
        axios.get(`${API_BASE_URL}/api/stats/weekly-volume`),
      ]);

      // setOneRepMaxData(oneRepMaxResponse.data); // This line was removed
      // setVolumeData(volumeResponse.data); // This line was removed
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
                      {Array.isArray(muscleGroups) && muscleGroups.map(mg => (
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