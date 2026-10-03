import { useMemo, useState } from 'react'
import { MARKETS, DEFAULT_SYMBOL, getMarket } from '../../lib/markets'
import { supabase } from '../../lib/supabase'
import { changedCount } from '../../lib/read/diff'
import { Sigil } from '../../components/Sigil'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import type { Page } from './nav'
import { TradingWorkspace } from '../trading/TradingWorkspace'
import { Portfolio } from '../portfolio/Portfolio'
import { Activity } from '../activity/Activity'
import { Home } from '../home/Home'
import { useMarketRead } from '../home/useMarketRead'
import { usePaperTrading } from '../trading/usePaperTrading'
import { useTickers } from '../trading/useTickers'

interface AppShellProps {
  userId: string
  email: string
}

interface MetaStrip {
  pipes: string[]
  keys: Array<{ k: string; label: string }>
}

const WELCOME_KEY = 'dispel-welcome-dismissed'

function clockFromIso(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  return `${hours}:${minutes} UTC`
}

function metaFor(page: Page, readAt: string | null): MetaStrip {
  if (page === 'home') {
    const readLabel = readAt === null ? 'Read pending' : `Read ${clockFromIso(readAt)}`
    const nextLabel =
      readAt === null
        ? 'Next on schedule'
        : `Next ${clockFromIso(new Date(Date.parse(readAt) + 15 * 60_000).toISOString())}`
    return {
      pipes: ['Binance public data', readLabel, nextLabel, 'Paper trading', 'On-chain data: Coin Metrics'],
      keys: [
        { k: '↑↓', label: 'setup' },
        { k: '↵', label: 'open chart' },
        { k: 'E', label: 'why' },
      ],
    }
  }
  if (page === 'trade') {
    return {
      pipes: ['Binance public data', 'Stream live', 'Paper trading'],
      keys: [
        { k: '/', label: 'search' },
        { k: 'B', label: 'buy' },
        { k: 'S', label: 'sell' },
        { k: 'L', label: 'levels' },
      ],
    }
  }
  if (page === 'portfolio') {
    return {
      pipes: ['Marks from Binance public prices', 'Settles on every fill', 'Paper trading'],
      keys: [
        { k: 'T', label: 'trade selected' },
        { k: 'D', label: 'deposit' },
      ],
    }
  }
  return {
    pipes: ['Simulated transfers', 'Address checked per network', 'Paper trading'],
    keys: [
      { k: '↵', label: 'confirm' },
      { k: 'Esc', label: 'clear' },
    ],
  }
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
  const tickers = useTickers(paper.positions.map((position) => position.symbol))
  const marks = useMemo(
    () => Object.fromEntries(Object.entries(tickers).map(([symbol, ticker]) => [symbol, ticker.lastPrice])),
    [tickers],
  )
  const marketRead = useMarketRead({ positions: paper.positions, marks })

  const market = getMarket(selectedSymbol) ?? MARKETS[0]
  if (!market) {
    throw new Error('No markets configured')
  }

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
  const meta = metaFor(page, marketRead.readAt)
  const changeCount = marketRead.since === null ? 0 : changedCount(marketRead.since)

  return (
    <div className="app">
      <Sigil className="ambient" mood="favorable" size={1120} arc={false} hot strokeBoost={1.9} />
      <Sidebar page={page} changeCount={changeCount} onNavigate={setPage} />
      <div className="mainwrap">
        <TopBar title={title} email={email} demo={marketRead.source === 'demo'} onSignOut={signOut} />
        <main className="main">
          {page === 'home' ? (
            <Home
              userId={userId}
              selectedSymbol={selectedSymbol}
              paper={paper}
              read={marketRead.read}
              since={marketRead.since}
              seenAt={marketRead.seenAt}
              stale={marketRead.stale}
              staleMinutes={marketRead.staleMinutes}
              partial={marketRead.status === 'degraded'}
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
              read={marketRead.read}
              onSelectSymbol={setSelectedSymbol}
              paper={paper}
            />
          ) : page === 'portfolio' ? (
            <Portfolio paper={paper} read={marketRead.read} onOpenActivity={() => setPage('activity')} onOpenTrade={openChart} />
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
