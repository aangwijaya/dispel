import type { ReactElement } from 'react'

export type Page = 'home' | 'trade' | 'portfolio' | 'activity'

export interface NavItem {
  id: Page
  label: string
  icon: () => ReactElement
}

export function HomeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M2.5 7.2 8 2.5l5.5 4.7V13a.5.5 0 0 1-.5.5H10V10H6v3.5H3a.5.5 0 0 1-.5-.5Z" />
    </svg>
  )
}

function TradeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M4 2v3.2M4 8.8V14M12 2v6.2M12 11.8V14" />
      <rect x="2.4" y="5.2" width="3.2" height="3.6" rx=".8" />
      <rect x="10.4" y="8.2" width="3.2" height="3.6" rx=".8" />
    </svg>
  )
}

function PortfolioIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M8 2v6h6" />
      <circle cx="8" cy="8" r="6" />
    </svg>
  )
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M8 2v12M4.5 5.5 8 2l3.5 3.5M4.5 10.5 8 14l3.5-3.5" />
    </svg>
  )
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'trade', label: 'Trade', icon: TradeIcon },
  { id: 'portfolio', label: 'Portfolio', icon: PortfolioIcon },
  { id: 'activity', label: 'Activity', icon: ActivityIcon },
]

/**
 * The mark: an open D drawn by the spell. The bowl stops on a square node at the sigil's tip angle (−35°).
 * At this size the node is solid; the app icon adds the faint track and an outlined node (src-tauri/app-icon.mjs).
 */
export function DispelMark() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M42 17H19V83H48A33 33 0 0 0 75 31.1" fill="none" stroke="#ff6363" strokeWidth="14" strokeLinejoin="round" />
      <rect x="66.5" y="22.6" width="17" height="17" fill="#fff" />
    </svg>
  )
}
