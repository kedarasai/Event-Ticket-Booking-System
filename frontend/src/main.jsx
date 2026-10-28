import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('RootErrorBoundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: '#ffffff', background: '#991b1b', fontFamily: 'monospace', margin: '2rem', borderRadius: '8px' }}>
          <h2>Application Initialization Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: '1rem', background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '4px' }}>
            {this.state.error?.stack || this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem', padding: '0.6rem 1.2rem', cursor: 'pointer', background: '#ffffff', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 600 }}
          >
            Reload Application
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>,
  )
} else {
  console.error('[TicketFlow] Fatal: #root element not found in DOM!')
}
