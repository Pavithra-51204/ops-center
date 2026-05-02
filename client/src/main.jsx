import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ color: '#ef4444', fontSize: '2rem', marginBottom: '1rem' }}>⚠</div>
            <h1 style={{ color: '#f1f5f9', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Ops-Center failed to load</h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem', maxWidth: '400px' }}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Reload
            </button>
            <details style={{ marginTop: '1.5rem', color: '#475569', fontSize: '0.75rem', textAlign: 'left', maxWidth: '500px' }}>
              <summary style={{ cursor: 'pointer', color: '#64748b' }}>Stack trace</summary>
              <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {this.state.error?.stack}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
