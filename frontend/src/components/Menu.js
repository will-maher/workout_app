import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  LibraryBooks as LibraryIcon,
  Logout as LogoutIcon,
  Flag as GoalIcon,
  EventNote as PlanIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { Panel, PageHeader, pageSx, dialogPaperProps, TEAL, DANGER } from './ui';

const Row = ({ icon, title, subtitle, onClick, danger, last }) => (
  <Box
    role="button"
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      px: 1.5,
      minHeight: 56,
      cursor: 'pointer',
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.06)',
      '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' },
    }}
  >
    <Box sx={{ display: 'grid', placeItems: 'center', color: danger ? DANGER : TEAL, '& svg': { fontSize: 20 } }}>
      {icon}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: danger ? DANGER : 'text.primary' }}>{title}</Typography>
      {subtitle && (
        <Typography noWrap sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{subtitle}</Typography>
      )}
    </Box>
    {!danger && <ChevronRightIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.22)' }} />}
  </Box>
);

const Menu = ({ user, onNavigate, onLogout }) => {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const initial = (user?.username || '?').charAt(0).toUpperCase();

  return (
    <Box sx={pageSx}>
      <PageHeader title="Menu" />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {/* Who is signed in. This used to be a disabled list row, which read
            as a broken menu item. */}
        <Panel sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
              display: 'grid', placeItems: 'center',
              fontSize: 15, fontWeight: 700, color: TEAL,
              backgroundColor: `${TEAL}1a`, border: `1px solid ${TEAL}44`,
            }}
          >
            {initial}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>{user?.username || 'Signed in'}</Typography>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Signed in</Typography>
          </Box>
        </Panel>

        <Panel sx={{ p: 0, overflow: 'hidden' }}>
          <Row icon={<PlanIcon />} title="Workout Plan" subtitle="Build and name your workouts" onClick={() => onNavigate('/plan')} />
          <Row icon={<GoalIcon />} title="Goals" subtitle="1RM targets and progress" onClick={() => onNavigate('/goals')} />
          <Row icon={<LibraryIcon />} title="Exercise Library" subtitle="Add or edit exercises" onClick={() => onNavigate('/library')} last />
        </Panel>

        <Panel sx={{ p: 0, overflow: 'hidden' }}>
          <Row icon={<LogoutIcon />} title="Log out" onClick={() => setConfirmLogout(true)} danger last />
        </Panel>
      </Box>

      <Dialog open={confirmLogout} onClose={() => setConfirmLogout(false)} PaperProps={dialogPaperProps}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 700 }}>Log out?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            Sets you've added but not saved stay on this device.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setConfirmLogout(false)} sx={{ fontSize: 13, textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button
            onClick={() => { setConfirmLogout(false); onLogout(); }}
            sx={{ fontSize: 13, fontWeight: 700, textTransform: 'none', px: 2, borderRadius: 2, color: '#fff', backgroundColor: '#b33030', '&:hover': { backgroundColor: '#c73c3c' } }}
          >
            Log out
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Menu;
