import React from 'react';
import { Box, Typography } from '@mui/material';

const TEAL = '#00d4aa';

// The app icon, inlined so the sign-in screen carries the same mark as the
// home-screen shortcut it was launched from.
const LogoMark = ({ size = 60 }) => (
  <Box
    sx={{
      width: size,
      height: size,
      borderRadius: 3,
      display: 'grid',
      placeItems: 'center',
      background: 'linear-gradient(145deg, rgba(0,212,170,0.20) 0%, rgba(0,212,170,0.05) 100%)',
      border: '1px solid rgba(0,212,170,0.30)',
      boxShadow: '0 10px 30px -14px rgba(0,212,170,0.8)',
    }}
  >
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 512 512" aria-hidden="true">
      <g transform="rotate(-30 256 256)" fill={TEAL}>
        <rect x="166" y="236" width="180" height="40" rx="20" />
        <ellipse cx="166" cy="256" rx="42" ry="88" />
        <ellipse cx="346" cy="256" rx="42" ry="88" />
      </g>
    </svg>
  </Box>
);

// Shared field styling so both forms look identical.
export const authFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.03)',
    fontSize: 14,
    '& fieldset': { borderColor: 'rgba(255,255,255,0.09)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
    '&.Mui-focused fieldset': { borderColor: TEAL, borderWidth: 1 },
  },
  '& .MuiInputBase-input': { color: 'text.primary', fontSize: 14, py: 1.5 },
  '& .MuiInputLabel-root': { fontSize: 14, color: 'rgba(255,255,255,0.45)' },
  '& .MuiInputLabel-root.Mui-focused': { color: TEAL },
  '& .MuiFormHelperText-root': { fontSize: 11, ml: 0.5 },
};

export const authButtonSx = {
  mt: 2.5,
  height: 46,
  borderRadius: 2,
  fontSize: 14,
  fontWeight: 800,
  textTransform: 'none',
  letterSpacing: '0.01em',
  color: '#06140F',
  background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL}c8 100%)`,
  boxShadow: `0 6px 18px -10px ${TEAL}`,
  '&:hover': { background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL} 100%)` },
  '&.Mui-disabled': { color: 'rgba(6,20,15,0.45)', background: 'rgba(0,212,170,0.28)', boxShadow: 'none' },
  '&:active': { transform: 'scale(0.99)' },
  transition: 'transform .12s ease',
};

const AuthShell = ({ mode, onSwitch, children }) => (
  <Box
    sx={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      px: 2,
      pt: 'calc(24px + env(safe-area-inset-top, 0px))',
      pb: 'calc(24px + env(safe-area-inset-bottom, 0px))',
    }}
  >
    <Box sx={{ width: '100%', maxWidth: 380 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
        <LogoMark />
        <Typography sx={{ mt: 1.75, fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em' }}>
          Workout Tracker
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: 12.5, color: 'rgba(255,255,255,0.40)' }}>
          Track every lift. Watch it add up.
        </Typography>
      </Box>

      <Box
        sx={{
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.07)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 100%)',
          p: 2.5,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            p: 0.375,
            mb: 2.5,
            borderRadius: 2,
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {[['login', 'Sign in'], ['register', 'Create account']].map(([key, label]) => {
            const active = mode === key;
            return (
              <Box
                key={key}
                onClick={() => { if (!active) onSwitch(); }}
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  py: 0.875,
                  borderRadius: 1.5,
                  cursor: active ? 'default' : 'pointer',
                  userSelect: 'none',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: active ? '#06140F' : 'rgba(255,255,255,0.55)',
                  backgroundColor: active ? TEAL : 'transparent',
                  transition: 'background-color .2s ease, color .2s ease',
                  '&:hover': active ? {} : { color: 'rgba(255,255,255,0.85)' },
                }}
              >
                {label}
              </Box>
            );
          })}
        </Box>

        {children}
      </Box>
    </Box>
  </Box>
);

export default AuthShell;
