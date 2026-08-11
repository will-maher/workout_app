import React, { useState } from 'react';
import { TextField, Button, Alert, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { API_BASE_URL } from '../App';
import AuthShell, { authFieldSx, authButtonSx } from './AuthShell';

const MIN_PASSWORD = 6;

function Register({ onRegister, switchToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Mirror the server's rules client-side so mistakes are caught before a
  // round trip, rather than coming back as a generic failure.
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    username.trim().length > 0 &&
    password.length >= MIN_PASSWORD &&
    confirm === password &&
    !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      localStorage.setItem('token', data.token);
      onRegister(data);
    } catch (err) {
      setError(err instanceof TypeError ? "Can't reach the server. Check your connection and try again." : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell mode="register" onSwitch={switchToLogin}>
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
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          fullWidth
          size="small"
          autoComplete="new-password"
          error={touched.password && passwordTooShort}
          helperText={
            touched.password && passwordTooShort
              ? `Use at least ${MIN_PASSWORD} characters`
              : `At least ${MIN_PASSWORD} characters`
          }
          sx={{ ...authFieldSx, mb: 1.75 }}
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

        <TextField
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          fullWidth
          size="small"
          autoComplete="new-password"
          error={mismatch}
          helperText={mismatch ? "Passwords don't match" : ' '}
          sx={authFieldSx}
        />

        <Button type="submit" fullWidth disabled={!canSubmit} sx={{ ...authButtonSx, mt: 1.5 }}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}

export default Register;
