import { NAV_ITEMS, type Page } from './nav'

interface BottomNavProps {
  page: Page
  changeCount: number
  onNavigate: (page: Page) => void
}

export function BottomNav({ page, changeCount, onNavigate }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = item.id === page
        return (
          <button
            key={item.id}
            type="button"
            className={active ? 'on' : undefined}
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon />
            {item.label}
            {item.id === 'home' && changeCount > 0 ? <span className="cnt">{changeCount}</span> : null}
          </button>
        )
      })}
    </nav>
  )
}
