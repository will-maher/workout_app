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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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

  // Desktop nav links (for AppBar)
  const navLinks = [
    { label: 'Add', path: '/add', icon: <AddIcon /> },
    { label: 'Plan', path: '/plan', icon: <PlanIcon /> },
    { label: 'Performance', path: '/performance', icon: <BarChart /> },
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
      <AppBar position="fixed" elevation={0} sx={{ borderRadius: { xs: 0, sm: 0 }, zIndex: 1201 }}> {/* Fixed and above other content */}
        <Toolbar>
          <WorkoutIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Workout Tracker
          </Typography>
          {user && (
            <>
              {/* Replace logout button with menu icon */}
              <IconButton
                size="large"
                edge="end"
                color="inherit"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                sx={{ ml: 1 }}
              >
                <AccountCircle />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                keepMounted
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                open={menuOpen}
                onClose={handleClose}
              >
                <MenuItem disabled>
                  <Typography variant="subtitle2">{user.username}</Typography>
                </MenuItem>
                <MenuItem onClick={() => handleMenuNavigate('/history')}>History</MenuItem>
                <MenuItem onClick={() => handleMenuNavigate('/exercises')}>Exercise Library</MenuItem>
                <MenuItem onClick={handleMenuLogout} sx={{ color: 'error.main' }}>Logout</MenuItem>
              </Menu>
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
          maxWidth: 'lg',
          position: 'relative',
          zIndex: 1,
          minHeight: isMobile ? 'calc(100vh - 72px)' : 'auto',
          pt: { xs: 8, sm: 9 }, // Add top padding for fixed AppBar (64px/72px)
        }}
      >
        <Routes>
          <Route path="/" element={<WorkoutEntry />} />
          <Route path="/add" element={<WorkoutEntry />} />
          <Route path="/plan" element={<WorkoutPlanner />} />
          <Route path="/performance" element={<Performance />} />
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
            zIndex: 1000,
            borderRadius: 0, // Ensure square
            height: 72, // Thicker/higher on mobile
            boxShadow: '0 -2px 16px 0 rgba(34,34,59,0.08)',
            // Ensure it stays in place on mobile
            transform: 'translateZ(0)', // Force hardware acceleration
            willChange: 'transform', // Optimize for animations
            // Prevent any movement
            top: 'auto',
            width: '100vw',
            maxWidth: '100vw',
            overflow: 'hidden',
          }} 
          elevation={3}
        >
          <BottomNavigation
            value={value}
            onChange={handleNavigationChange}
            showLabels
            sx={{ 
              height: 72, // Thicker/higher on mobile
              // Ensure stable positioning
              position: 'relative',
              width: '100%',
              maxWidth: '100%',
              overflow: 'hidden',
            }}
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
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}

export default App; 