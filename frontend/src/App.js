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
  Menu,
  MenuItem,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  EventNote as PlanIcon,
  BarChart,
  AccountCircle,
} from '@mui/icons-material';
import axios from 'axios';

// Import components
import WorkoutEntry from './components/WorkoutEntry';
import WorkoutHistory from './components/WorkoutHistory';
import Stats from './components/Stats';
import ExerciseLibrary from './components/ExerciseLibrary';
import Performance from './components/Performance';
import WorkoutPlanner from './components/WorkoutPlanner';
import Login from './components/Login';
import Register from './components/Register';

// API base URL configuration
export const API_BASE_URL = 'https://workoutapp-production-3c56.up.railway.app';

function App() {
  const [value, setValue] = useState(0);
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const menuOpen = Boolean(anchorEl);

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
    else if (path === '/plan') setValue(1);
    else if (path === '/performance') setValue(2);
  }, [location]);

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

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMenuNavigate = (path) => {
    navigate(path);
    handleClose();
  };

  const handleMenuLogout = () => {
    handleLogout();
    handleClose();
  };

  const handleNavigationChange = (event, newValue) => {
    setValue(newValue);
    if (newValue === 0) navigate('/add');
    else if (newValue === 1) navigate('/plan');
    else if (newValue === 2) navigate('/performance');
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
        sx={{ 
          top: 0, 
          left: 0, 
          right: 0, 
          zIndex: 1100,
          backgroundColor: 'white',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'grey.200',
          boxShadow: 'none'
        }}
      >
        <Toolbar sx={{ minHeight: 56, px: 2 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600, fontSize: 18 }}>
            Workout App
          </Typography>
          <IconButton
            size="large"
            onClick={handleMenu}
            sx={{ color: 'text.primary' }}
          >
            <AccountCircle />
          </IconButton>
        </Toolbar>
      </AppBar>
      
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 150,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            border: '1px solid',
            borderColor: 'grey.200'
          }
        }}
      >
        <MenuItem onClick={handleClose} disabled sx={{ color: 'text.secondary', fontSize: 14 }}>
          {user?.username}
        </MenuItem>
        <MenuItem onClick={() => handleMenuNavigate('/history')} sx={{ fontSize: 14 }}>
          History
        </MenuItem>
        <MenuItem onClick={() => handleMenuNavigate('/library')} sx={{ fontSize: 14 }}>
          Exercise Library
        </MenuItem>
        <MenuItem onClick={handleMenuLogout} sx={{ fontSize: 14 }}>
          Logout
        </MenuItem>
      </Menu>

      <Box sx={{ 
        pt: 7, // Account for fixed AppBar
        pb: 8, // Account for BottomNavigation
        minHeight: '100vh',
        backgroundColor: 'grey.50'
      }}>
        <Container maxWidth="lg" sx={{ px: 2 }}>
          <Routes>
            <Route path="/" element={<WorkoutEntry />} />
            <Route path="/add" element={<WorkoutEntry />} />
            <Route path="/history" element={<WorkoutHistory />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/library" element={<ExerciseLibrary />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/plan" element={<WorkoutPlanner />} />
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
          zIndex: 1100,
          borderTop: '1px solid',
          borderColor: 'grey.200',
          boxShadow: 'none'
        }} 
        elevation={0}
      >
        <BottomNavigation
          value={value}
          onChange={handleNavigationChange}
          sx={{ 
            height: 64,
            backgroundColor: 'white'
          }}
        >
          <BottomNavigationAction
            label="Add"
            value={0}
            icon={<AddIcon />}
            sx={{ 
              '&.Mui-selected': { color: 'primary.main' },
              fontSize: 12
            }}
          />
          <BottomNavigationAction
            label="Plan"
            value={1}
            icon={<PlanIcon />}
            sx={{ 
              '&.Mui-selected': { color: 'primary.main' },
              fontSize: 12
            }}
          />
          <BottomNavigationAction
            label="Performance"
            value={2}
            icon={<BarChart />}
            sx={{ 
              '&.Mui-selected': { color: 'primary.main' },
              fontSize: 12
            }}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

export default App; 