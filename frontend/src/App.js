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
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  History as HistoryIcon,
  BarChart,
  Menu as MenuIcon,
} from '@mui/icons-material';
import axios from 'axios';

// Import components
import WorkoutEntry from './components/WorkoutEntry';
import WorkoutHistory from './components/WorkoutHistory';
import ExerciseLibrary from './components/ExerciseLibrary';
import Performance from './components/Performance';
import WorkoutPlanner from './components/WorkoutPlanner';
import Goals from './components/Goals';
import GoalDetail from './components/GoalDetail';
import MenuPage from './components/Menu';
import Login from './components/Login';
import Register from './components/Register';

// API base URL configuration
// - CRA dev server (port 3000) talks to the local backend on 5001
// - When served by the backend itself, use same-origin relative URLs
//   (no CORS preflight requests)
// - Any other host (e.g. legacy separate frontend service) targets the
//   production API directly
// REACT_APP_API_URL overrides all of the above when set at build time.
const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const isCraDevServer = isLocalhost && window.location.port === '3000';
const BACKEND_HOST = 'workoutapp-production-3c56.up.railway.app';
const isSameOriginAsBackend = isLocalhost || window.location.hostname === BACKEND_HOST;

export const API_BASE_URL =
  process.env.REACT_APP_API_URL ??
  (isCraDevServer
    ? 'http://localhost:5001'
    : isSameOriginAsBackend
      ? ''
      : `https://${BACKEND_HOST}`);

// Accent colour for mobility exercises (distinct from the teal strength accent).
export const MOBILITY_PINK = '#E877A6';

// For debugging - log the current environment and API URL (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Hostname:', window.location.hostname);
  console.log('API Base URL:', API_BASE_URL);
}

function App() {
  const [value, setValue] = useState(0);
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!statusMessage) return;
    const t = setTimeout(() => setStatusMessage(''), 4000);
    return () => clearTimeout(t);
  }, [statusMessage]);

  // Check for token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ username: payload.username });
      } catch {
        setUser(null);
        localStorage.removeItem('token');
      }
    }
  }, []);

  // Axios interceptor to attach JWT token to all requests
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Prepend API base URL if the URL starts with /api
        if (config.url && config.url.startsWith('/api')) {
          config.url = API_BASE_URL + config.url;
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token expiration
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem('token');
          setUser(null);
          navigate('/login');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(interceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [navigate]);

  // Update navigation value based on current route
  useEffect(() => {
    const path = location.pathname;
    if (path === '/' || path === '/add') setValue(0);
    else if (path === '/history') setValue(1);
    else if (path === '/performance') setValue(2);
    else if (path === '/menu' || path.startsWith('/goals') || path === '/library' || path === '/plan') setValue(3);
  }, [location]);

  const handleLogin = (data) => {
    setUser({ username: data.username });
    setShowRegister(false);
    setValue(0);
    navigate('/add');
  };

  const handleRegister = (data) => {
    setUser({ username: data.username });
    setShowRegister(false);
    setValue(0);
    navigate('/add');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('cachedPlan'); // Clear cached plan on logout
    setUser(null);
  };

  const handleNavigationChange = (event, newValue) => {
    setValue(newValue);
    if (newValue === 0) navigate('/add');
    else if (newValue === 1) navigate('/history');
    else if (newValue === 2) navigate('/performance');
    else if (newValue === 3) navigate('/menu');
  };

  if (!user) {
    return showRegister ? (
      <Register onRegister={handleRegister} switchToLogin={() => setShowRegister(false)} />
    ) : (
      <Login onLogin={handleLogin} switchToRegister={() => setShowRegister(true)} />
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar 
        position="fixed" 
        elevation={0}
        sx={{ 
          top: 0, 
          left: 0, 
          right: 0, 
          zIndex: 1100,
          borderRadius: 0
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 48, px: 2, gap: 1, py: 0 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>
            Workout Tracker
          </Typography>
          {statusMessage ? (
            <Alert
              severity={statusMessage.includes('Error') ? 'error' : 'success'}
              onClose={() => setStatusMessage('')}
              sx={{
                py: 0,
                maxWidth: { xs: '55vw', sm: 360 },
                fontSize: 12,
                backgroundColor: 'transparent',
                border: 'none',
                boxShadow: 'none',
                color: statusMessage.includes('Error') ? 'error.main' : 'primary.main',
                '& .MuiAlert-message': {
                  color: 'inherit',
                  padding: '2px 0',
                },
                '& .MuiAlert-icon': {
                  color: 'inherit',
                },
                '& .MuiAlert-action': {
                  color: 'inherit',
                  alignItems: 'center',
                },
              }}
            >
              {statusMessage}
            </Alert>
          ) : null}
        </Toolbar>
      </AppBar>
      


      <Box sx={{ 
        pt: 6, // fixed AppBar (~48px)
        pb: 7, // Account for BottomNavigation (~56px)
        minHeight: '100vh',
        backgroundColor: 'background.default'
      }}>
        <Container
          key={location.pathname}
          maxWidth="md"
          sx={{
            px: 2,
            animation: 'pageFadeIn 0.15s ease',
            '@keyframes pageFadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
          }}
        >
          <Routes>
            <Route path="/" element={<WorkoutEntry onStatusMessage={setStatusMessage} />} />
            <Route path="/add" element={<WorkoutEntry onStatusMessage={setStatusMessage} />} />
            <Route path="/history" element={<WorkoutHistory />} />
            <Route path="/library" element={<ExerciseLibrary />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/plan" element={<WorkoutPlanner user={user} />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/goals/:id" element={<GoalDetail />} />
            <Route path="/menu" element={<MenuPage user={user} onNavigate={navigate} onLogout={handleLogout} />} />
            <Route path="/login" element={<Login onLogin={handleLogin} switchToRegister={() => setShowRegister(true)} />} />
            <Route path="/register" element={<Register onRegister={handleRegister} switchToLogin={() => setShowRegister(false)} />} />
          </Routes>
        </Container>
      </Box>

      <Paper 
        sx={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          zIndex: 1100
        }} 
        elevation={0}
      >
        <BottomNavigation
          value={value}
          onChange={handleNavigationChange}
          sx={{
            height: 56,
            pb: 'env(safe-area-inset-bottom)',
            boxSizing: 'content-box',
          }}
        >
          <BottomNavigationAction
            label="Add"
            value={0}
            icon={<AddIcon />}
          />
          <BottomNavigationAction
            label="History"
            value={1}
            icon={<HistoryIcon />}
          />
          <BottomNavigationAction
            label="Performance"
            value={2}
            icon={<BarChart />}
          />
          <BottomNavigationAction
            label="Menu"
            value={3}
            icon={<MenuIcon />}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

export default App; 