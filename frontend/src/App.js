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
} from '@mui/material';
import {
  Add as AddIcon,
  EventNote as PlanIcon,
  BarChart,
} from '@mui/icons-material';
import axios from 'axios';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import AccountCircle from '@mui/icons-material/AccountCircle';

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

// Debug logging (commented out to prevent console errors)
// console.log('Environment:', process.env.NODE_ENV);
// console.log('API Base URL:', API_BASE_URL);
// console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);

function App() {
  const [value, setValue] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
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

  // Update navigation value based on current route
  React.useEffect(() => {
    const path = location.pathname;
    if (path === '/' || path === '/add') setValue(0);
    else if (path === '/plan') setValue(1);
    else if (path === '/performance') setValue(2);
  }, [location]);

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
          {user && (
            <IconButton
              size="large"
              onClick={handleMenu}
              sx={{ color: 'text.primary' }}
            >
              <AccountCircle />
            </IconButton>
          )}
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