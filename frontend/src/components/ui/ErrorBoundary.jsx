import { Component } from 'react'
import { AlertIcon } from './Icons'
import { Button } from './Button'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = () => {
    this.props.onReset?.()
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, retry: this.handleRetry })
          : this.props.fallback
      }

      return (
        <div className="error-boundary-card" role="alert">
          <div className="error-boundary-icon">
            <AlertIcon size={42} />
          </div>
          <h2 className="error-boundary-title">Something went wrong</h2>
          <p className="error-boundary-msg">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <Button variant="primary" onClick={this.handleRetry}>
            Try Again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
