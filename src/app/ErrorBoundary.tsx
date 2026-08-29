import { Component } from 'react'
import type { ReactNode } from 'react'
import { downloadFile } from '../lib/download'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Last line of defence: if a render throws (poisoned storage that slipped
 * past the decoder, a bug), the user gets their data out and a way back in —
 * never a permanent white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  private exportRaw = () => {
    const dump: Record<string, string | null> = {}
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('gym')) dump[key] = localStorage.getItem(key)
      }
    } catch {
      /* dump whatever we could read */
    }
    downloadFile(
      `gym-app-raw-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(dump, null, 2),
    )
  }

  private reset = () => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('gym')) localStorage.removeItem(key)
      }
    } catch {
      /* best effort */
    }
    location.reload()
  }

  render() {
    if (this.state.error === null) return this.props.children
    return (
      <div style={{ padding: '48px 24px', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22 }}>Something broke</h1>
        <p style={{ color: 'var(--muted, #93a1b2)' }}>
          The app hit an error it couldn't recover from. Your data may still be
          intact — download it first, then reset.
        </p>
        <pre
          style={{
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            opacity: 0.6,
            maxHeight: 120,
            overflow: 'auto',
          }}
        >
          {String(this.state.error)}
        </pre>
        <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
          <button className="btn" onClick={this.exportRaw}>
            Download backup
          </button>
          <button className="btn danger" onClick={this.reset}>
            Reset app
          </button>
        </div>
      </div>
    )
  }
}
