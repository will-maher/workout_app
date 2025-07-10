import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  useTheme,
  useMediaQuery,
  Button,
} from '@mui/material';
import {
  FitnessCenter as WorkoutIcon,
  Add as AddIcon,
  History as HistoryIcon,
  MoreHoriz as MoreIcon,
  EventNote as PlanIcon,
  MenuBook as LibraryIcon,
  BarChart,
} from '@mui/icons-material';
import axios from 'axios';

// Import components
import WorkoutEntry from './components/WorkoutEntry';
import WorkoutHistory from './components/WorkoutHistory';
import Stats from './components/Stats';
import ExerciseLibrary from './components/ExerciseLibrary';
import Performance from './components/Performance';
import { Link } from 'react-router-dom';
import WorkoutPlanner from './components/WorkoutPlanner';
import Login from './components/Login';
import Register from './components/Register';

// API base URL configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://workoutapp-production-3c56.up.railway.app' 
    : 'http://localhost:5001');

// Debug logging (commented out to prevent console errors)
// console.log('Environment:', process.env.NODE_ENV);
// console.log('API Base URL:', API_BASE_URL);
// console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);

// More page with links to History and Exercise Library
const More = () => (
  <Box maxWidth={480} mx="auto" mt={4}>
    <Typography variant="h4" fontWeight={700} gutterBottom align="center">
      More
    </Typography>
    <Box display="flex" flexDirection="column" gap={2} mt={2}>
      <Button component={Link} to="/history" variant="outlined" startIcon={<HistoryIcon />} fullWidth>
        History
      </Button>
      <Button component={Link} to="/exercises" variant="outlined" startIcon={<LibraryIcon />} fullWidth>
        Exercise Library
      </Button>
    </Box>
  </Box>
);

function App() {
  const [value, setValue] = useState(0);
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  // Check for token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ username: payload.username });
      } catch {
        setUser(null);
      }
    }
  }, []);

  // Attach token to all fetch requests and use correct base URL
  useEffect(() => {
    const origFetch = window.fetch;
    window.fetch = (url, options = {}) => {
      const token = localStorage.getItem('token');
      if (token) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = 'Bearer ' + token;
      }
      
      // Prepend API base URL if the URL starts with /api
      if (url.startsWith('/api')) {
        url = API_BASE_URL + url;
      }
      
      return origFetch(url, options);
    };
    return () => { window.fetch = origFetch; };
  }, []);

  // Axios interceptor to attach JWT token to all requests
  React.useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers['Authorization'] = 'Bearer ' + token;
        }
        
        // Prepend API base URL if the URL starts with /api
        if (config.url && config.url.startsWith('/api')) {
          config.url = API_BASE_URL + config.url;
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );
    return () => axios.interceptors.request.eject(interceptor);
  }, []);

  const handleLogin = (data) => {
    setUser({ username: data.username });
    setShowRegister(false);
  };
  const handleRegister = (data) => {
    setUser({ username: data.username });
    setShowRegister(false);
  };
  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Update navigation value based on current route
  React.useEffect(() => {
    const path = location.pathname;
    if (path === '/' || path === '/add') setValue(0);
    else if (path === '/plan') setValue(1);
    else if (path === '/performance') setValue(2);
    else if (path === '/more') setValue(3);
  }, [location]);

  const handleNavigationChange = (event, newValue) => {
    setValue(newValue);
    if (newValue === 0) navigate('/add');
    else if (newValue === 1) navigate('/plan');
    else if (newValue === 2) navigate('/performance');
    else if (newValue === 3) navigate('/more');
  };

  // Desktop nav links (for AppBar)
  const navLinks = [
    { label: 'Add', path: '/add', icon: <AddIcon /> },
    { label: 'Plan', path: '/plan', icon: <PlanIcon /> },
    { label: 'Performance', path: '/performance', icon: <BarChart /> },
    { label: 'More', path: '/more', icon: <MoreIcon /> },
  ];

  if (!user) {
    return showRegister ? (
      <Register onRegister={handleRegister} switchToLogin={() => setShowRegister(false)} />
    ) : (
      <Login onLogin={handleLogin} switchToRegister={() => setShowRegister(true)} />
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <WorkoutIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Workout Tracker
          </Typography>
          {user && (
            <>
              <Typography sx={{ mr: 2 }} fontWeight={600}>
                {user.username}
              </Typography>
              <Button color="inherit" onClick={handleLogout} sx={{ fontWeight: 600 }}>
                Logout
              </Button>
            </>
          )}
          {/* Desktop navigation */}
          {!isMobile && navLinks.map((link, idx) => (
            <Button
              key={link.label}
              color={location.pathname === link.path ? 'primary' : 'inherit'}
              variant={location.pathname === link.path ? 'contained' : 'text'}
              startIcon={link.icon}
              sx={{ ml: 1, fontWeight: 600, borderRadius: 2, boxShadow: 'none', textTransform: 'none' }}
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </Button>
          ))}
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          py: 3,
          pb: isMobile ? 10 : 3, // Add bottom padding for mobile navigation
          maxWidth: 'lg'
        }}
      >
        <Routes>
          <Route path="/" element={<WorkoutEntry />} />
          <Route path="/add" element={<WorkoutEntry />} />
          <Route path="/plan" element={<WorkoutPlanner />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/more" element={<More />} />
          <Route path="/history" element={<WorkoutHistory />} />
          <Route path="/exercises" element={<ExerciseLibrary />} />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </Container>

      {/* Bottom Navigation (Mobile) */}
      {isMobile && (
        <Paper 
          sx={{ 
            position: 'fixed', 
            bottom: 0, 
            left: 0, 
            right: 0,
            zIndex: 1000
          }} 
          elevation={3}
        >
          <BottomNavigation
            value={value}
            onChange={handleNavigationChange}
            showLabels
          >
            <BottomNavigationAction
              label="Add"
              icon={<AddIcon />}
            />
            <BottomNavigationAction
              label="Plan"
              icon={<PlanIcon />}
            />
            <BottomNavigationAction
              label="Performance"
              icon={<BarChart />}
            />
            <BottomNavigationAction
              label="..."
              icon={<MoreIcon />}
            />
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}

export default App; 