import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
} from '@mui/material';
import {
  History as HistoryIcon,
  LibraryBooks as LibraryIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

const Menu = ({ user, onNavigate, onLogout }) => {
  const menuItems = [
    {
      icon: <PersonIcon />,
      text: user?.username || 'User',
      disabled: true,
      onClick: null,
    },
    {
      icon: <HistoryIcon />,
      text: 'Workout History',
      onClick: () => onNavigate('/history'),
    },
    {
      icon: <LibraryIcon />,
      text: 'Exercise Library',
      onClick: () => onNavigate('/library'),
    },
  ];

  return (
    <Box sx={{ 
      maxWidth: 400, 
      mx: 'auto', 
      mt: 2,
      px: 2
    }}>
      <Typography 
        variant="h4" 
        fontWeight={700} 
        textAlign="center" 
        sx={{ mb: 4 }}
      >
        Menu
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 0 }}>
          <List>
            {menuItems.map((item, index) => (
              <React.Fragment key={item.text}>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={item.onClick}
                    disabled={item.disabled}
                    sx={{
                      py: 2,
                      px: 3,
                      '&:hover': {
                        bgcolor: 'background.default',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ 
                      color: item.disabled ? 'text.secondary' : 'primary.main',
                      minWidth: 40 
                    }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.text}
                      primaryTypographyProps={{
                        fontWeight: item.disabled ? 400 : 500,
                        color: item.disabled ? 'text.secondary' : 'text.primary',
                      }}
                    />
                  </ListItemButton>
                </ListItem>
                {index < menuItems.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <List>
            <ListItem disablePadding>
              <ListItemButton
                onClick={onLogout}
                sx={{
                  py: 2,
                  px: 3,
                  '&:hover': {
                    bgcolor: 'error.light',
                    color: 'error.contrastText',
                  },
                }}
              >
                <ListItemIcon sx={{ 
                  color: 'error.main',
                  minWidth: 40 
                }}>
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Logout"
                  primaryTypographyProps={{
                    fontWeight: 500,
                    color: 'error.main',
                  }}
                />
              </ListItemButton>
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Menu;
