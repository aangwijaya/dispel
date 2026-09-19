import { useSyncExternalStore } from 'react'
import { getConnectionStatus, subscribeConnectionStatus, type DisplayStatus } from '../../lib/market/stream'
import type { Theme } from '../../lib/theme'

interface TopBarProps {
  title: string
  theme: Theme
  onToggleTheme: () => void
  email: string
  onSignOut: () => void
}

const STATUS_LABEL: Record<DisplayStatus, string> = {
  connected: 'Live',
  connecting: 'Connecting',
  disconnected: 'Offline',
  idle: 'Idle',
}

const STATUS_TONE: Record<DisplayStatus, string> = {
  connected: 'bg-buy',
  connecting: 'bg-warn',
  disconnected: 'bg-sell',
  idle: 'bg-faint',
}

function StatusBadge() {
  const status = useSyncExternalStore(subscribeConnectionStatus, getConnectionStatus)
  return (
    <div className="flex items-center gap-1.5 rounded-pill border border-edge px-2.5 py-1" title="Market data connection">
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_TONE[status]}`} />
      <span className="text-micro font-medium text-faint">{STATUS_LABEL[status]}</span>
    </div>
  )
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="8" cy="8" r="3.2" />
        <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M13.3 9.6A5.6 5.6 0 0 1 6.4 2.7a5.6 5.6 0 1 0 6.9 6.9Z" />
    </svg>
  )
}

export function TopBar({ title, theme, onToggleTheme, email, onSignOut }: TopBarProps) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-edge bg-panel px-4">
      <div className="flex items-center gap-3">
        <h1 className="text-subheading font-semibold tracking-tight text-ink">{title}</h1>
        <StatusBadge />
      </div>
      <div className="flex items-center gap-2">
        <span className="max-w-52 truncate text-caption text-faint" title={email}>
          {email}
        </span>
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-inset hover:text-ink"
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
        >
          <ThemeIcon theme={theme} />
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="h-7 rounded-pill border border-edge px-3 text-caption font-medium text-body transition-colors hover:bg-inset hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
