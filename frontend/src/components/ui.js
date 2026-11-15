import React from 'react';
import { Box, Typography } from '@mui/material';

// Shared surface and label primitives, so every screen is built from the same
// parts as the Add tab rather than each defining its own card style.

export const TEAL = '#00d4aa';
export const DANGER = '#F09595';

export const hideScrollbarSx = {
  '&::-webkit-scrollbar': { display: 'none' },
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
};

export const pageSx = { maxWidth: 540, mx: 'auto', pt: 1.5, pb: 2, px: { xs: 1.5, sm: 0 } };

export const dialogPaperProps = {
  sx: { borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', backgroundImage: 'none' },
};

export const Panel = ({ children, sx = {}, ...rest }) => (
  <Box
    sx={{
      borderRadius: 3,
      border: '1px solid rgba(255,255,255,0.07)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 100%)',
      p: 1.5,
      ...sx,
    }}
    {...rest}
  >
    {children}
  </Box>
);

export const PanelLabel = ({ children, right, sx = {} }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1, ...sx }}>
    <Typography
      sx={{
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: '0.11em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.42)',
      }}
    >
      {children}
    </Typography>
    {right}
  </Box>
);

export const PageHeader = ({ title, right, left }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5, minHeight: 34 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      {left}
      <Typography noWrap sx={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.025em' }}>
        {title}
      </Typography>
    </Box>
    {right}
  </Box>
);

export const primaryButtonSx = {
  height: 32,
  px: 1.75,
  borderRadius: 2,
  fontSize: 12.5,
  fontWeight: 700,
  textTransform: 'none',
  whiteSpace: 'nowrap',
  color: '#06140F',
  backgroundColor: TEAL,
  '&:hover': { backgroundColor: '#00e6b8' },
  '&.Mui-disabled': { color: 'rgba(6,20,15,0.45)', backgroundColor: 'rgba(0,212,170,0.28)' },
};

export const StatCard = ({ label, value, unit, accent }) => (
  <Panel sx={{ p: 1.25, minWidth: 0 }}>
    <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5, lineHeight: 1.3 }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 17, fontWeight: 700, color: accent || 'text.primary', lineHeight: 1.1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
      {value}
      {unit && (
        <Box component="span" sx={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(255,255,255,0.4)', ml: 0.5, letterSpacing: 0 }}>{unit}</Box>
      )}
    </Typography>
  </Panel>
);
