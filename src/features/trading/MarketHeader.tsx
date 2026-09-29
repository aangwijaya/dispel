import { useEffect, useRef, useState } from 'react'
import { subscribeMarket } from '../../lib/market/stream'
import { formatCompact, formatPrice } from '../../lib/market/format'
import { PriceChange } from '../../components/PriceChange'
import type { Market, Ticker } from '../../types/market'

interface MarketHeaderProps {
  market: Market
  watched: boolean
  onToggleWatch: (symbol: string) => void
  onOpenMarkets: () => void
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      {label}
      <b>{value}</b>
    </div>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3">
      <path d="M8 1.8l1.8 3.7 4.1.6-3 2.9.7 4.1L8 11.2l-3.6 1.9.7-4.1-3-2.9 4.1-.6L8 1.8Z" />
    </svg>
  )
}

export function MarketHeader({ market, watched, onToggleWatch, onOpenMarkets }: MarketHeaderProps) {
  const [ticker, setTicker] = useState<Ticker | null>(null)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)
  const previous = useRef<string | null>(null)

  useEffect(() => {
    setTicker(null)
    previous.current = null
    return subscribeMarket(market.symbol, { onTicker: setTicker })
  }, [market.symbol])

  useEffect(() => {
    if (!ticker) return
    const last = ticker.lastPrice
    if (previous.current !== null && last !== previous.current) {
      setFlash(Number(last) >= Number(previous.current) ? 'up' : 'down')
      previous.current = last
      const timer = window.setTimeout(() => setFlash(null), 450)
      return () => window.clearTimeout(timer)
    }
    previous.current = last
  }, [ticker])

  return (
    <div className="mh">
      <div className="id">
        <span className="ico">{market.baseAsset.slice(0, 3)}</span>
        <span>
          <b>
            {market.displayName} <span className="tag">Spot</span>
          </b>
          <small>
            {market.baseAsset} · Binance spot · {market.quoteAsset}
          </small>
        </span>
      </div>

      <div className="price">
        <b className={flash === 'up' ? 'tick-up' : flash === 'down' ? 'tick-down' : undefined}>
          {formatPrice(ticker?.lastPrice, market.pricePrecision)}
        </b>
        <PriceChange value={ticker?.changePercent} />
      </div>

      <div className="stats">
        <Stat label="24h high" value={formatPrice(ticker?.highPrice, market.pricePrecision)} />
        <Stat label="24h low" value={formatPrice(ticker?.lowPrice, market.pricePrecision)} />
        <Stat label="24h volume" value={formatCompact(ticker?.volume)} />
        <Stat label="24h quote" value={formatCompact(ticker?.quoteVolume)} />
      </div>

      <button type="button" className="ghost mk-open" onClick={onOpenMarkets}>
        Markets
      </button>
      <button
        type="button"
        className="star"
        onClick={() => onToggleWatch(market.symbol)}
        title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
        aria-pressed={watched}
        style={watched ? undefined : { color: 'var(--smoke)' }}
      >
        <StarIcon filled={watched} />
      </button>
    </div>
  )
}
