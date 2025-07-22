import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Alert, Link } from '@mui/material';
import { API_BASE_URL } from '../App';

function Login({ onLogin, switchToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('token', data.token);
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxWidth={400} mx="auto" mt={6} p={3} borderRadius={2} boxShadow={2} bgcolor="#fff">
      <Typography variant="h5" fontWeight={700} mb={2} align="center">Login</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <form onSubmit={handleSubmit}>
        <TextField
          label="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          fullWidth
          margin="normal"
          autoFocus
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          fullWidth
          margin="normal"
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          sx={{ mt: 2, mb: 1 }}
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </Button>
      </form>
      <Typography align="center" mt={2}>
        Don't have an account?{' '}
        <Link component="button" onClick={switchToRegister}>Register</Link>
      </Typography>
    </Box>
  );
}

export default Login; 