import { useEffect, useMemo, useRef, useState } from 'react'
import { MARKETS } from '../../lib/markets'
import { formatPrice } from '../../lib/market/format'
import { TONE_COLOR } from '../../lib/read/demo'
import type { Market, Ticker } from '../../types/market'
import type { ReadTag } from '../../types/read'
import { useTickers } from './useTickers'
import { Pct } from '../home/Pct'

type Tab = 'watch' | 'all'

interface MarketsPanelProps {
  symbols: string[]
  tags: Record<string, ReadTag>
  selectedSymbol: string
  overlay: boolean
  onSelect: (symbol: string) => void
  onClose: () => void
}

export function MarketsPanel({ symbols, tags, selectedSymbol, overlay, onSelect, onClose }: MarketsPanelProps) {
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const tickers = useTickers(MARKETS.map((market) => market.symbol))

  useEffect(() => {
    if (overlay) inputRef.current?.focus()
  }, [overlay])

  useEffect(() => {
    if (!overlay) setQuery('')
  }, [overlay])

  const watched = useMemo(() => new Set(symbols), [symbols])

  const rows = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    return MARKETS.filter((market) => {
      if (tab === 'watch' && !watched.has(market.symbol)) return false
      if (trimmed === '') return true
      return (
        market.displayName.toLowerCase().includes(trimmed) ||
        market.baseAsset.toLowerCase().includes(trimmed)
      )
    })
  }, [query, tab, watched])

  function select(symbol: string) {
    onSelect(symbol)
    if (overlay) onClose()
  }

  return (
    <section className={`panel mk ${overlay ? 'search-open' : ''}`} aria-label="Markets">
      <button type="button" className="mk-close" onClick={onClose}>
        Close
      </button>
      <div className="search">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3 3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search markets"
          aria-label="Search markets"
        />
        <kbd>/</kbd>
      </div>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'watch'} onClick={() => setTab('watch')}>
          Watchlist
        </button>
        <button type="button" role="tab" aria-selected={tab === 'all'} onClick={() => setTab('all')}>
          All
        </button>
      </div>
      <div className="mk-list">
        {rows.length === 0 ? (
          <p className="mk-empty">
            {tab === 'watch' ? 'No markets on your watchlist yet.' : 'No markets match.'}
          </p>
        ) : (
          rows.map((market) => (
            <MarketRow
              key={market.symbol}
              market={market}
              ticker={tickers[market.symbol]}
              tag={tags[market.baseAsset] ?? { label: '—', tone: 'neutral' }}
              selected={market.symbol === selectedSymbol}
              onSelect={select}
            />
          ))
        )}
      </div>
    </section>
  )
}

function MarketRow({
  market,
  ticker,
  tag,
  selected,
  onSelect,
}: {
  market: Market
  ticker: Ticker | undefined
  tag: ReadTag
  selected: boolean
  onSelect: (symbol: string) => void
}) {
  const change = Number(ticker?.changePercent ?? 0)

  return (
    <button
      type="button"
      className="mrow"
      aria-current={selected}
      onClick={() => onSelect(market.symbol)}
    >
      <span className="ico">{market.baseAsset.slice(0, 3)}</span>
      <span>
        <b>{market.displayName}</b>
        <span className="sub">
          <i style={{ background: TONE_COLOR[tag.tone] }} />
          {tag.label}
        </span>
      </span>
      <span className="px">
        {formatPrice(ticker?.lastPrice, market.pricePrecision)}
        <span>
          <Pct value={change} />
        </span>
      </span>
    </button>
  )
}
