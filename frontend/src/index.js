import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';

// Create a custom theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#22223b', // deep blue-gray (keep existing dark blue)
    },
    secondary: {
      main: '#9a8c98', // muted purple accent
    },
    background: {
      default: '#F9F6EE', // eggshell white
      paper: '#F9F6EE', // eggshell white
    },
    text: {
      primary: '#22223b',
      secondary: '#4a4e69',
    },
  },
  typography: {
    fontFamily: 'Courier, Courier New, monospace',
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.5px',
      fontSize: '1.7rem', // was 2.125rem
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.05rem', // was 1.25rem
    },
    body1: {
      fontSize: '0.97rem', // was 1rem
    },
    body2: {
      fontSize: '0.85rem', // was 0.875rem
    },
  },
  shape: {
    borderRadius: 10, // was 16
  },
  spacing: 6, // was 8
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 500,
          paddingLeft: 16,
          paddingRight: 16,
          minHeight: 32,
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          paddingLeft: 16,
          paddingRight: 16,
          '@media (max-width: 600px)': {
            paddingLeft: 12,
            paddingRight: 12,
          },
        },
      },
    },
    MuiGrid: {
      styleOverrides: {
        root: {
          '@media (max-width: 600px)': {
            margin: 0,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          boxShadow: '0 2px 12px 0 rgba(34,34,59,0.04)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '6px 12px',
        },
        head: {
          padding: '6px 12px',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: 44,
          paddingLeft: 8,
          paddingRight: 8,
        },
      },
    },
  },
});

// Add global CSS to prevent horizontal overflow on mobile
const globalStyles = `
  * {
    box-sizing: border-box;
  }
  
  html, body {
    overflow-x: hidden;
    width: 100%;
    max-width: 100vw;
  }
  
  #root {
    overflow-x: hidden;
    width: 100%;
    max-width: 100vw;
  }
  
  @media (max-width: 600px) {
    body {
      padding: 0;
      margin: 0;
    }
    
    .MuiContainer-root {
      padding-left: 12px !important;
      padding-right: 12px !important;
    }
    
    .MuiGrid-root {
      margin: 0 !important;
    }
    
    /* Ensure bottom navigation stays fixed */
    .MuiPaper-root[style*="position: fixed"] {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      transform: translateZ(0) !important;
      will-change: transform !important;
    }
    
    /* Prevent viewport issues on mobile */
    @supports (-webkit-touch-callout: none) {
      /* iOS Safari specific fixes */
      body {
        -webkit-overflow-scrolling: touch;
      }
      
      .MuiPaper-root[style*="position: fixed"] {
        position: fixed !important;
        bottom: env(safe-area-inset-bottom, 0) !important;
      }
    }
    
    /* Ensure dropdowns appear above all content */
    .MuiPaper-root[style*="z-index: 9999"] {
      z-index: 9999 !important;
      position: absolute !important;
    }
    
    /* Prevent parent containers from clipping dropdowns */
    .MuiCard-root {
      overflow: visible !important;
    }
    
    .MuiCardContent-root {
      overflow: visible !important;
    }
  }
`;

// Inject global styles
const styleSheet = document.createElement('style');
styleSheet.type = 'text/css';
styleSheet.innerText = globalStyles;
document.head.appendChild(styleSheet);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then(
      registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      },
      err => {
        console.log('ServiceWorker registration failed: ', err);
      }
    );
  });
} 