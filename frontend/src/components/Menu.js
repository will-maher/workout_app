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
    {
      icon: <LogoutIcon />,
      text: 'Logout',
      onClick: onLogout,
      isLogout: true,
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

      <Card>
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
                        bgcolor: item.isLogout ? 'error.light' : 'background.default',
                        color: item.isLogout ? 'error.contrastText' : 'inherit',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ 
                      color: item.isLogout ? 'error.main' : 'text.primary',
                      minWidth: 40 
                    }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.text}
                      primaryTypographyProps={{
                        fontWeight: 500,
                        color: item.isLogout ? 'error.main' : 'text.primary',
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
    </Box>
  );
};

export default Menu;
