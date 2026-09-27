import { useEffect, useState } from 'react'
import { setupForSymbol } from '../../lib/read/demo'
import { MarketsPanel } from './MarketsPanel'
import { MarketHeader } from './MarketHeader'
import { SetupStrip } from './SetupStrip'
import { TradingChart } from './TradingChart'
import { OrderBook } from './OrderBook'
import { OrderEntry } from './OrderEntry'
import { BottomPanel } from '../orders/BottomPanel'
import { useWatchlist } from './useWatchlist'
import type { Market } from '../../types/market'
import type { PaperTrading } from './usePaperTrading'

interface TradingWorkspaceProps {
  userId: string
  market: Market
  onSelectSymbol: (symbol: string) => void
  paper: PaperTrading
}

export function TradingWorkspace({ userId, market, onSelectSymbol, paper }: TradingWorkspaceProps) {
  const watch = useWatchlist(userId)
  const [searchOpen, setSearchOpen] = useState(false)
  const [ctxHidden, setCtxHidden] = useState(false)
  const setup = setupForSymbol(market.symbol)

  useEffect(() => {
    setCtxHidden(false)
  }, [market.symbol])

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')) return
      if (event.key === '/') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  function closeSearch() {
    setSearchOpen(false)
  }

  return (
    <div className="ws">
      <MarketsPanel
        symbols={watch.symbols}
        selectedSymbol={market.symbol}
        overlay={false}
        onSelect={onSelectSymbol}
        onClose={closeSearch}
      />

      <div className="col">
        <section className="panel">
          <MarketHeader
            market={market}
            watched={watch.symbols.includes(market.symbol)}
            onToggleWatch={(symbol) => void watch.toggle(symbol)}
            onOpenMarkets={() => setSearchOpen(true)}
          />
          {setup && !ctxHidden ? <SetupStrip setup={setup} onHide={() => setCtxHidden(true)} /> : null}
        </section>
        <TradingChart market={market} />
        <BottomPanel paper={paper} />
      </div>

      <div className="col">
        <OrderEntry market={market} paper={paper} />
        <OrderBook market={market} />
      </div>

      {searchOpen ? (
        <MarketsPanel
          symbols={watch.symbols}
          selectedSymbol={market.symbol}
          overlay
          onSelect={onSelectSymbol}
          onClose={closeSearch}
        />
      ) : null}
    </div>
  )
}
