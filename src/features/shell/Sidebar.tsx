import type { ReactElement } from 'react'

export type Page = 'trade' | 'portfolio' | 'activity'

interface SidebarProps {
  page: Page
  onNavigate: (page: Page) => void
}

function TradeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M4 2v3.2M4 8.8V14M12 2v6.2M12 11.8V14" />
      <rect x="2.4" y="5.2" width="3.2" height="3.6" rx="0.8" />
      <rect x="10.4" y="8.2" width="3.2" height="3.6" rx="0.8" />
    </svg>
  )
}

function PortfolioIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M8 2v6h6" />
      <circle cx="8" cy="8" r="6" />
    </svg>
  )
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M8 2v12M4.5 5.5 8 2l3.5 3.5M4.5 10.5 8 14l3.5-3.5" />
    </svg>
  )
}

const NAV_ITEMS: Array<{ id: Page; label: string; icon: () => ReactElement }> = [
  { id: 'trade', label: 'Trade', icon: TradeIcon },
  { id: 'portfolio', label: 'Portfolio', icon: PortfolioIcon },
  { id: 'activity', label: 'Activity', icon: ActivityIcon },
]

export function Sidebar({ page, onNavigate }: SidebarProps) {
  return (
    <aside className="flex w-44 shrink-0 flex-col border-r border-edge bg-panel">
      <div className="flex h-11 items-center gap-2 border-b border-edge px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <span className="text-caption font-semibold tracking-tight text-ink">Dispel</span>
      </div>
      <nav className="flex flex-col gap-0.5 p-2" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = item.id === page
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-caption font-medium transition-colors ${
                active ? 'bg-inset text-ink' : 'text-faint hover:bg-inset hover:text-ink'
              }`}
            >
              <Icon />
              {item.label}
            </button>
          )
        })}
      </nav>
      <div className="mt-auto p-3">
        <div className="rounded-card bg-inset p-3">
          <p className="text-micro font-semibold uppercase tracking-wide text-faint">Paper account</p>
          <p className="mt-1 text-micro text-faint">Simulated funds only.</p>
        </div>
      </div>
    </aside>
  )
}
