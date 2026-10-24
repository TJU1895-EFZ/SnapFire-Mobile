import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Keeps a render crash from leaving the player on a blank page.  A camera or
 * WebGL failure should be recoverable by reloading, so the fallback offers a
 * single obvious action.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[app] render failed', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="fatal-screen">
        <h1 className="fatal-screen__title">SNAPFIRE</h1>
        <p className="fatal-screen__message">
          页面出现异常，需要重新加载。
          {'\n'}
          {this.state.error.message}
        </p>
        <button className="primary-button" onClick={() => window.location.reload()}>
          重新加载
        </button>
      </div>
    )
  }
}
