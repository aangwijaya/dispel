import { useSyncExternalStore } from 'react'
import { getConnectionStatus, subscribeConnectionStatus, type DisplayStatus } from '../../lib/market/stream'

interface TopBarProps {
  title: string
  email: string
  demo: boolean
  onSignOut: () => void
}

const STATUS_LABEL: Record<DisplayStatus, string> = {
  connected: 'Live',
  connecting: 'Connecting',
  disconnected: 'Offline',
  idle: 'Idle',
}

const STATUS_COLOR: Record<DisplayStatus, string> = {
  connected: 'var(--up)',
  connecting: 'var(--caution)',
  disconnected: 'var(--down)',
  idle: 'var(--smoke)',
}

export function TopBar({ title, email, demo, onSignOut }: TopBarProps) {
  const status = useSyncExternalStore(subscribeConnectionStatus, getConnectionStatus)

  return (
    <header className="top">
      <div className="top-l">
        <h2>{title}</h2>
        <span className="pill" title="Market data connection">
          <i style={{ background: STATUS_COLOR[status] }} />
          {STATUS_LABEL[status]}
        </span>
      </div>
      <div className="top-r">
        {demo ? (
          <span className="pill mock" title="Market read values are demo design data">
            Demo data
          </span>
        ) : null}
        <span className="email" title={email}>
          {email}
        </span>
        <button type="button" className="ghost" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  )
}
