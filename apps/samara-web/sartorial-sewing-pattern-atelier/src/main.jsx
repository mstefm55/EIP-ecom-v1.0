import React, { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Class-based React ErrorBoundary to catch and diagnose runtime crashes safely
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[Perfect Fit Recovery] Caught unhandled runtime exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          fontFamily: 'monospace',
          backgroundColor: '#FAF8F5',
          color: '#8A583C',
          border: '2px solid #BA6446',
          borderRadius: '4px',
          margin: '40px auto',
          maxWidth: '800px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)',
          whiteSpace: 'pre-wrap',
          textAlign: 'left'
        }}>
          <h2 style={{ fontFamily: 'serif', fontSize: '24px', margin: '0 0 16px 0', color: '#1A1A1E' }}>
            Perfect Fit Engine Recovery Mode
          </h2>
          <p style={{ fontSize: '13px', lineHeight: '1.5', color: '#555', margin: '0 0 20px 0' }}>
            Something went wrong while rendering Perfect Fit Bureau\'s blueprints. This is usually caused by a mismatch in local browser cache, storage, or temporary state parameters.
          </p>
          <div style={{
            backgroundColor: '#FFF5F0',
            border: '1px solid #FFDDD0',
            padding: '16px',
            borderRadius: '4px',
            fontSize: '11px',
            overflowX: 'auto',
            maxHeight: '300px',
            marginBottom: '24px',
            color: '#A04020'
          }}>
            <strong>Error details:</strong> {this.state.error ? this.state.error.toString() : 'Unknown Error'}
            {this.state.errorInfo && (
              <div style={{ marginTop: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '11px', color: '#666' }}>
                {this.state.errorInfo.componentStack}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              try {
                localStorage.clear();
                sessionStorage.clear();
              } catch {}
              window.location.reload();
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1A1A1E',
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontFamily: 'sans-serif',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          >
            Purge Storage &amp; Restart App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Clean up any legacy Service Workers in a sandbox-safe block
try {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) {
            console.log('[Service Worker] Successfully unregistered stale worker:', registration);
          }
        });
      }
    }).catch((err) => {
      console.error('[Service Worker] Failed to unregister:', err);
    });
  }
} catch (e) {
  console.warn('[Service Worker] Ignored cache cleanup due to security sandbox constraints:', e);
}

// Purge browser Cache Storage in a sandbox-safe block
try {
  if ('caches' in window) {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        console.log('[Cache] Purging cache key:', key);
        return caches.delete(key);
      }));
    }).then(() => {
      console.log('[Cache] All caches successfully cleared.');
    }).catch((err) => {
      console.error('[Cache] Failed to clear caches:', err);
    });
  }
} catch (e) {
  console.warn('[Cache] Ignored cache storage clearance due to security sandbox constraints:', e);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
