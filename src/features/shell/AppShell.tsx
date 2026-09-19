import { useState } from 'react'
import { MARKETS, DEFAULT_SYMBOL, getMarket } from '../../lib/markets'
import { applyTheme, getStoredTheme, type Theme } from '../../lib/theme'
import { supabase } from '../../lib/supabase'
import { Sidebar, type Page } from './Sidebar'
import { TopBar } from './TopBar'
import { TradingWorkspace } from '../trading/TradingWorkspace'
import { Portfolio } from '../portfolio/Portfolio'
import { usePaperTrading } from '../trading/usePaperTrading'

interface AppShellProps {
  userId: string
  email: string
}

export function AppShell({ userId, email }: AppShellProps) {
  const [page, setPage] = useState<Page>('trade')
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL)
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  const paper = usePaperTrading(true)

  const market = getMarket(selectedSymbol) ?? MARKETS[0]
  if (!market) {
    throw new Error('No markets configured')
  }

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  function signOut() {
    void supabase.auth.signOut()
  }

  return (
    <div className="flex h-full min-h-0 bg-canvas text-body">
      <Sidebar page={page} onNavigate={setPage} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={page === 'trade' ? market.displayName : 'Portfolio'}
          theme={theme}
          onToggleTheme={toggleTheme}
          email={email}
          onSignOut={signOut}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {page === 'trade' ? (
            <TradingWorkspace
              userId={userId}
              market={market}
              theme={theme}
              onSelectSymbol={setSelectedSymbol}
              paper={paper}
            />
          ) : (
            <Portfolio paper={paper} />
          )}
        </main>
      </div>
    </div>
  )
}
