import { useState } from 'react'
import { MARKETS, DEFAULT_SYMBOL, getMarket } from '../../lib/markets'
import { supabase } from '../../lib/supabase'
import { AURA_ART, DEMO_READ, changeSummary } from '../../lib/read/demo'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import type { Page } from './nav'
import { TradingWorkspace } from '../trading/TradingWorkspace'
import { Portfolio } from '../portfolio/Portfolio'
import { Activity } from '../activity/Activity'
import { Home } from '../home/Home'
import { usePaperTrading } from '../trading/usePaperTrading'

interface AppShellProps {
  userId: string
  email: string
}

interface MetaStrip {
  pipes: string[]
  keys: Array<{ k: string; label: string }>
}

const WELCOME_KEY = 'dispel-welcome-dismissed'

const META: Record<Page, MetaStrip> = {
  home: {
    pipes: ['Binance public data', `Read ${DEMO_READ.time}`, 'Next 14:47', 'Paper trading'],
    keys: [
      { k: '↑↓', label: 'setup' },
      { k: '↵', label: 'open chart' },
      { k: 'E', label: 'why' },
    ],
  },
  trade: {
    pipes: ['Binance public data', 'Stream live', 'Paper trading'],
    keys: [
      { k: '/', label: 'search' },
      { k: 'B', label: 'buy' },
      { k: 'S', label: 'sell' },
      { k: 'L', label: 'levels' },
    ],
  },
  portfolio: {
    pipes: ['Binance public data', 'Paper trading'],
    keys: [{ k: '↵', label: 'open trade' }],
  },
  activity: {
    pipes: ['Binance public data', 'Simulated transfers', 'Paper trading'],
    keys: [],
  },
}

export function AppShell({ userId, email }: AppShellProps) {
  const [page, setPage] = useState<Page>('home')
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL)
  const [firstLaunch, setFirstLaunch] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_KEY) !== 'done'
    } catch {
      return true
    }
  })
  const paper = usePaperTrading(true)

  const market = getMarket(selectedSymbol) ?? MARKETS[0]
  if (!market) {
    throw new Error('No markets configured')
  }

  const changeCount = firstLaunch ? 0 : changeSummary(DEMO_READ).count

  function signOut() {
    void supabase.auth.signOut()
  }

  function dismissWelcome() {
    try {
      localStorage.setItem(WELCOME_KEY, 'done')
    } catch {
      // Ignore storage failures; the banner simply shows again next launch.
    }
    setFirstLaunch(false)
  }

  function openChart(symbol: string) {
    setSelectedSymbol(symbol)
    setPage('trade')
  }

  const title =
    page === 'home' ? 'Home' : page === 'trade' ? market.displayName : page === 'portfolio' ? 'Portfolio' : 'Activity'
  const meta = META[page]

  return (
    <div className="app">
      <img className="ambient" src={AURA_ART[DEMO_READ.stance]} alt="" aria-hidden="true" />
      <Sidebar page={page} changeCount={changeCount} onNavigate={setPage} />
      <div className="mainwrap">
        <TopBar title={title} email={email} demo onSignOut={signOut} />
        <main className="main">
          {page === 'home' ? (
            <Home
              userId={userId}
              selectedSymbol={selectedSymbol}
              paper={paper}
              firstLaunch={firstLaunch}
              onDismissWelcome={dismissWelcome}
              onOpenChart={openChart}
              onOpenTrade={() => setPage('trade')}
              onOpenPortfolio={() => setPage('portfolio')}
              onOpenActivity={() => setPage('activity')}
            />
          ) : page === 'trade' ? (
            <TradingWorkspace
              userId={userId}
              market={market}
              onSelectSymbol={setSelectedSymbol}
              paper={paper}
            />
          ) : page === 'portfolio' ? (
            <Portfolio paper={paper} onOpenActivity={() => setPage('activity')} />
          ) : (
            <Activity paper={paper} />
          )}
        </main>
        <footer className="meta-strip">
          <div className="pipes">
            {meta.pipes.map((pipe) => (
              <span key={pipe}>{pipe}</span>
            ))}
          </div>
          {meta.keys.length > 0 ? (
            <div className="keys">
              {meta.keys.map((key) => (
                <span key={key.k}>
                  <kbd>{key.k}</kbd> {key.label}
                </span>
              ))}
            </div>
          ) : null}
        </footer>
        <BottomNav page={page} changeCount={changeCount} onNavigate={setPage} />
      </div>
    </div>
  )
}
