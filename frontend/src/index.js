import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';
import theme from './theme';

// Add global CSS for ReVanced-inspired dark theme
const globalStyles = `
  * {
    box-sizing: border-box;
  }
  
  html, body {
    overflow-x: hidden;
    width: 100%;
    max-width: 100vw;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
    color: #ffffff;
  }
  
  #root {
    overflow-x: hidden;
    width: 100%;
    max-width: 100vw;
    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
    min-height: 100vh;
  }
  
  /* Smooth scrolling */
  html {
    scroll-behavior: smooth;
  }
  
  /* ReVanced-style scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: #1a1a1a;
  }
  
  ::-webkit-scrollbar-thumb {
    background: #00d4aa;
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #00e6b8;
  }
  
  /* Mobile optimizations */
  @media (max-width: 600px) {
    body {
      padding: 0;
      margin: 0;
    }
    
    .MuiContainer-root {
      padding-left: 16px !important;
      padding-right: 16px !important;
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
    
    /* iOS Safari specific fixes */
    @supports (-webkit-touch-callout: none) {
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
  
  /* ReVanced-style focus styles */
  .MuiButton-root:focus-visible,
  .MuiTextField-root .MuiInputBase-root:focus-within,
  .MuiIconButton-root:focus-visible {
    outline: 2px solid #00d4aa;
    outline-offset: 2px;
  }
  
  /* Enhanced transitions */
  .MuiButton-root,
  .MuiCard-root,
  .MuiPaper-root {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Glow effects for primary elements */
  .MuiButton-contained {
    position: relative;
    overflow: hidden;
  }
  
  .MuiButton-contained::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }
  
  .MuiButton-contained:hover::before {
    left: 100%;
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