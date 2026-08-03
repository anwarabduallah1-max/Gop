import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unknown error' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, message: '' })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', background: '#0d0f14', color: '#f5f7fa', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ fontSize: 48, marginBottom: 20, opacity: 0.3 }}>★</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ fontSize: 15, color: '#c4c9d4', maxWidth: 460, lineHeight: 1.6, marginBottom: 8 }}>
            The app encountered an unexpected error. This is often caused by missing or incorrect environment variables.
          </p>
          <p style={{ fontSize: 13, color: '#6b7280', maxWidth: 460, marginBottom: 24, fontFamily: 'monospace' }}>
            {this.state.message}
          </p>
          <button onClick={this.handleReload} style={{ background: '#f5c842', color: '#0d0f14', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
