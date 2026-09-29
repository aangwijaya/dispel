import { NAV_ITEMS, DispelMark, type Page } from './nav'

interface SidebarProps {
  page: Page
  changeCount: number
  onNavigate: (page: Page) => void
}

export function Sidebar({ page, changeCount, onNavigate }: SidebarProps) {
  return (
    <aside className="side">
      <div className="logo">
        <DispelMark />
        <span>Dispel</span>
      </div>
      <nav className="nav" aria-label="Main navigation">
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
              {item.id === 'home' && changeCount > 0 ? (
                <span className="cnt" title="Changes since your last visit">
                  {changeCount}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>
      <div className="side-foot">
        <span className="eyebrow">Paper account</span>
        <p>Simulated funds only. No real money moves.</p>
      </div>
    </aside>
  )
}
