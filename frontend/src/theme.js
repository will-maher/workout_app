import { createTheme } from '@mui/material/styles';

// ReVanced-inspired dark theme palette
const colors = {
  primary: {
    main: '#00d4aa', // Vibrant teal/cyan
    light: '#00e6b8',
    dark: '#00b894',
    contrastText: '#000000'
  },
  secondary: {
    main: '#6366f1', // Indigo
    light: '#818cf8',
    dark: '#4f46e5',
    contrastText: '#ffffff'
  },
  success: {
    main: '#10b981', // Emerald green
    light: '#34d399',
    dark: '#059669'
  },
  warning: {
    main: '#f59e0b', // Amber
    light: '#fbbf24',
    dark: '#d97706'
  },
  error: {
    main: '#ef4444', // Red
    light: '#f87171',
    dark: '#dc2626'
  },
  background: {
    default: '#0a0a0a', // Very dark background
    paper: '#1a1a1a' // Slightly lighter dark
  },
  text: {
    primary: '#ffffff',
    secondary: '#a1a1aa',
    disabled: '#71717a'
  },
  divider: '#27272a'
};

// Typography scale - ReVanced style
const typography = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
  h1: {
    fontSize: '2rem',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
    '@media (min-width:600px)': {
      fontSize: '2.5rem'
    }
  },
  h2: {
    fontSize: '1.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
    '@media (min-width:600px)': {
      fontSize: '2rem'
    }
  },
  h3: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.3,
    '@media (min-width:600px)': {
      fontSize: '1.5rem'
    }
  },
  h4: {
    fontSize: '1.125rem',
    fontWeight: 600,
    lineHeight: 1.4,
    '@media (min-width:600px)': {
      fontSize: '1.25rem'
    }
  },
  h5: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.5
  },
  h6: {
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.5
  },
  body1: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    fontWeight: 400,
    '@media (min-width:600px)': {
      fontSize: '1rem'
    }
  },
  body2: {
    fontSize: '0.8125rem',
    lineHeight: 1.6,
    fontWeight: 400,
    '@media (min-width:600px)': {
      fontSize: '0.875rem'
    }
  },
  button: {
    fontSize: '0.875rem',
    fontWeight: 600,
    textTransform: 'none',
    letterSpacing: '0.01em'
  },
  caption: {
    fontSize: '0.75rem',
    lineHeight: 1.5,
    fontWeight: 400
  }
};

// Component overrides - ReVanced style
const components = {
  MuiAppBar: {
    styleOverrides: {
      root: {
        backgroundColor: colors.background.paper,
        color: colors.text.primary,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        borderBottom: `1px solid ${colors.divider}`
      }
    }
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        border: `1px solid ${colors.divider}`,
        backdropFilter: 'blur(10px)',
        backgroundColor: colors.background.paper
      }
    }
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        padding: '12px 24px',
        fontWeight: 600,
        boxShadow: 'none',
        textTransform: 'none',
        letterSpacing: '0.01em',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: '0 8px 25px rgba(0, 212, 170, 0.3)'
        }
      },
      contained: {
        background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.primary.light} 100%)`,
        '&:hover': {
          background: `linear-gradient(135deg, ${colors.primary.dark} 0%, ${colors.primary.main} 100%)`,
          transform: 'translateY(-1px)',
          boxShadow: '0 8px 25px rgba(0, 212, 170, 0.4)'
        }
      },
      outlined: {
        borderColor: colors.primary.main,
        color: colors.primary.main,
        '&:hover': {
          backgroundColor: colors.primary.main,
          color: colors.primary.contrastText,
          transform: 'translateY(-1px)',
          boxShadow: '0 8px 25px rgba(0, 212, 170, 0.3)'
        }
      }
    }
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 12,
          backgroundColor: colors.background.paper,
          '& fieldset': {
            borderColor: colors.divider,
            borderWidth: '2px'
          },
          '&:hover fieldset': {
            borderColor: colors.primary.light
          },
          '&.Mui-focused fieldset': {
            borderColor: colors.primary.main,
            borderWidth: '2px'
          }
        },
        '& .MuiInputLabel-root': {
          color: colors.text.secondary
        },
        '& .MuiInputBase-input': {
          color: colors.text.primary
        }
      }
    }
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottom: `1px solid ${colors.divider}`,
        padding: '16px 12px',
        fontSize: '0.875rem'
      },
      head: {
        fontWeight: 600,
        backgroundColor: colors.background.default,
        color: colors.text.primary
      }
    }
  },
  MuiTableRow: {
    styleOverrides: {
      root: {
        '&:hover': {
          backgroundColor: colors.background.default
        }
      }
    }
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        fontWeight: 500,
        backgroundColor: colors.background.default,
        color: colors.text.primary
      }
    }
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        backgroundColor: colors.background.paper
      }
    }
  },
  MuiBottomNavigation: {
    styleOverrides: {
      root: {
        backgroundColor: colors.background.paper,
        borderTop: `1px solid ${colors.divider}`,
        boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.3)'
      }
    }
  },
  MuiBottomNavigationAction: {
    styleOverrides: {
      root: {
        color: colors.text.secondary,
        '&.Mui-selected': {
          color: colors.primary.main
        }
      }
    }
  },
  MuiSelect: {
    styleOverrides: {
      root: {
        backgroundColor: colors.background.paper,
        color: colors.text.primary
      }
    }
  },
  MuiMenuItem: {
    styleOverrides: {
      root: {
        backgroundColor: colors.background.paper,
        color: colors.text.primary,
        '&:hover': {
          backgroundColor: colors.background.default
        }
      }
    }
  },
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        border: `1px solid ${colors.divider}`,
        '& .MuiAlert-icon': {
          color: colors.text.primary
        }
      },
      standardError: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: colors.error.main,
        '& .MuiAlert-icon': {
          color: colors.error.main
        }
      },
      standardSuccess: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: colors.success.main,
        '& .MuiAlert-icon': {
          color: colors.success.main
        }
      }
    }
  }
};

// Create the theme
const theme = createTheme({
  palette: colors,
  typography,
  components,
  shape: {
    borderRadius: 8
  },
  spacing: 8,
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920
    }
  }
});

export default theme;
