import React, { useState } from 'react';
import { TextField, Button, Alert, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { API_BASE_URL } from '../App';
import AuthShell, { authFieldSx, authButtonSx } from './AuthShell';

function Login({ onLogin, switchToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('token', data.token);
      onLogin(data);
    } catch (err) {
      // fetch rejects with a TypeError when the network/server is unreachable,
      // which would otherwise surface as a meaningless "Failed to fetch".
      setError(err instanceof TypeError ? "Can't reach the server. Check your connection and try again." : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell mode="login" onSwitch={switchToRegister}>
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <Alert severity="error" sx={{ mb: 2, fontSize: 12.5, borderRadius: 2, py: 0.5 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          size="small"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          sx={{ ...authFieldSx, mb: 1.75 }}
        />

        <TextField
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          size="small"
          autoComplete="current-password"
          sx={authFieldSx}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword((v) => !v)}
                  edge="end"
                  size="small"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: 'rgba(255,255,255,0.7)' } }}
                >
                  {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button type="submit" fullWidth disabled={!canSubmit} sx={authButtonSx}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}

export default Login;
