import { useCallback, useEffect, useRef, useState } from 'react'
import type { MarketRead, SinceRow } from '../../types/read'
import type { PaperTrading } from '../trading/usePaperTrading'
import { useWatchlist } from '../trading/useWatchlist'
import { MarketReadPanel } from './MarketReadPanel'
import { SetupsPanel } from './SetupsPanel'
import { ChangesPanel } from './ChangesPanel'
import { Floor } from './Floor'
import { Sigil } from '../../components/Sigil'

interface HomeProps {
  userId: string
  selectedSymbol: string
  paper: PaperTrading
  read: MarketRead
  since: SinceRow[] | null
  seenAt: string | null
  stale: boolean
  staleMinutes: number
  firstLaunch: boolean
  onDismissWelcome: () => void
  onOpenChart: (symbol: string) => void
  onOpenTrade: () => void
  onOpenPortfolio: () => void
  onOpenActivity: () => void
}

export function Home({
  userId,
  selectedSymbol,
  paper,
  read,
  since,
  seenAt,
  stale,
  staleMinutes,
  firstLaunch,
  onDismissWelcome,
  onOpenChart,
  onOpenTrade,
  onOpenPortfolio,
  onOpenActivity,
}: HomeProps) {
  const watch = useWatchlist(userId)
  const [whyOpen, setWhyOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  const initialIndex = Math.max(
    read.setups.findIndex((setup) => setup.symbol === selectedSymbol),
    0,
  )
  const [selected, setSelected] = useState(initialIndex)

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')) return
      if ((event.key === 'e' || event.key === 'E') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        setWhyOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  async function toggleWatch(symbol: string) {
    const watched = watch.symbols.includes(symbol)
    await watch.toggle(symbol)
    showToast(watched ? `Removed ${symbol} from watchlist` : `Added ${symbol} to watchlist`)
  }

  function handleOpenChart(symbol: string) {
    onOpenChart(symbol)
    showToast(`Opening ${symbol} with the setup context`)
  }

  return (
    <>
      {firstLaunch ? (
        <div className="welcome">
          <Sigil className="wsigil" mood="favorable" size={460} strength={71} />
          <div>
            <span className="eyebrow">First launch</span>
            <h3>
              Welcome to Dispel. <em>Start with the read.</em>
            </h3>
            <p>Everything on this screen explains itself. Nothing here asks you to trade.</p>
          </div>
          <ol className="w-steps">
            <li>
              <kbd>1</kbd>Read the market
            </li>
            <li>
              <kbd>2</kbd>Look at a setup
            </li>
            <li>
              <kbd>3</kbd>Open its chart
            </li>
            <li>
              <kbd>4</kbd>Paper trade, if you want
            </li>
          </ol>
          <button type="button" className="btn" onClick={onDismissWelcome}>
            Got it
          </button>
        </div>
      ) : null}

      <MarketReadPanel
        read={read}
        firstLaunch={firstLaunch}
        stale={stale}
        staleMinutes={staleMinutes}
        whyOpen={whyOpen}
        onToggleWhy={() => setWhyOpen((open) => !open)}
      />

      <div className="row2">
        <SetupsPanel
          read={read}
          selected={selected}
          onSelect={setSelected}
          onOpenChart={handleOpenChart}
          onToggleWatch={(symbol) => void toggleWatch(symbol)}
          onReviewPortfolio={onOpenPortfolio}
        />
        <ChangesPanel read={read} since={since} seenAt={seenAt} />
      </div>

      <Floor
        userId={userId}
        read={read}
        paper={paper}
        onOpenTrade={onOpenTrade}
        onOpenPortfolio={onOpenPortfolio}
        onOpenActivity={onOpenActivity}
      />

      {toast ? <div className="toast">{toast}</div> : null}
    </>
  )
}
