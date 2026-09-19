import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('KisanGuard ErrorBoundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-left">
          <div className="max-w-xl w-full border border-red-300 bg-white p-6 shadow-none">
            <span className="font-mono text-xs uppercase tracking-widest text-red-700 font-bold block mb-1">
              [ APPLICATION RUNTIME EXCEPTION ]
            </span>
            <h2 className="font-serif text-xl font-bold text-slate-900">
              An unexpected interface error occurred.
            </h2>
            <p className="mt-2 text-xs font-mono text-slate-600">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <div className="mt-4 pt-4 border-t border-slate-200 flex gap-3 font-mono text-xs">
              <button
                onClick={() => { localStorage.clear(); window.location.href = '/login' }}
                className="btn-primary"
              >
                Reset Session &amp; Return to Login →
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn-secondary"
              >
                Reload Page ↻
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
