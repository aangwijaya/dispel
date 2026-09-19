import { useEffect, useState } from 'react'
import { MARKETS } from '../../lib/markets'
import { supabase } from '../../lib/supabase'
import { friendlyDbError } from '../../lib/errors'
import { formatPrice } from '../../lib/market/format'
import { PriceChange } from '../../components/PriceChange'
import { useTickers } from './useTickers'

interface MarketListProps {
  userId: string
  selectedSymbol: string
  onSelect: (symbol: string) => void
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <path d="M8 1.8l1.8 3.7 4.1.6-3 2.9.7 4.1L8 11.2l-3.6 1.9.7-4.1-3-2.9 4.1-.6L8 1.8Z" />
    </svg>
  )
}

export function MarketList({ userId, selectedSymbol, onSelect }: MarketListProps) {
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const tickers = useTickers(MARKETS.map((market) => market.symbol))

  useEffect(() => {
    let cancelled = false

    supabase
      .from('watchlist_items')
      .select('symbol')
      .order('created_at', { ascending: true })
      .then(({ data, error: loadError }) => {
        if (cancelled) return
        if (loadError) {
          setError(friendlyDbError(loadError.message))
          return
        }
        if (!Array.isArray(data)) return
        const symbols: string[] = []
        for (const row of data) {
          const symbol = (row as { symbol?: unknown }).symbol
          if (typeof symbol === 'string') symbols.push(symbol)
        }
        setWatchlist(symbols)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function toggleWatchlist(symbol: string) {
    const watched = watchlist.includes(symbol)
    setError(null)
    setWatchlist((previous) =>
      watched ? previous.filter((item) => item !== symbol) : [...previous, symbol],
    )

    const { error: writeError } = watched
      ? await supabase.from('watchlist_items').delete().eq('user_id', userId).eq('symbol', symbol)
      : await supabase.from('watchlist_items').insert({ user_id: userId, symbol })

    if (writeError) {
      setWatchlist((previous) =>
        watched ? [...previous, symbol] : previous.filter((item) => item !== symbol),
      )
      setError(friendlyDbError(writeError.message))
    }
  }

  const sortedMarkets = [...MARKETS].sort((a, b) => {
    const aWatched = watchlist.includes(a.symbol)
    const bWatched = watchlist.includes(b.symbol)
    if (aWatched !== bWatched) return aWatched ? -1 : 1
    return a.symbol.localeCompare(b.symbol)
  })

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-edge bg-panel">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-edge px-3">
        <span className="text-micro font-semibold uppercase tracking-wide text-faint">Markets</span>
        <span className="text-micro text-faint">{watchlist.length} watched</span>
      </div>

      {error ? <p className="border-b border-edge px-3 py-2 text-micro text-sell">{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sortedMarkets.map((market) => {
          const ticker = tickers[market.symbol]
          const watched = watchlist.includes(market.symbol)
          const active = market.symbol === selectedSymbol

          return (
            <div
              key={market.symbol}
              className={`group flex items-center border-b border-hairline ${active ? 'bg-inset' : 'hover:bg-inset'}`}
            >
              <button
                type="button"
                onClick={() => onSelect(market.symbol)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-caption font-medium text-ink">
                    {market.displayName}
                  </span>
                  <span className="block text-micro text-faint">{market.baseAsset}</span>
                </span>
                <span className="text-right">
                  <span className="block text-caption tabular-nums text-ink">
                    {formatPrice(ticker?.lastPrice, market.pricePrecision)}
                  </span>
                  <PriceChange value={ticker?.changePercent} className="block text-micro" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => void toggleWatchlist(market.symbol)}
                className={`mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:text-accent ${
                  watched ? 'text-accent' : 'text-faint opacity-0 group-hover:opacity-100'
                }`}
                title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                <StarIcon filled={watched} />
              </button>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
