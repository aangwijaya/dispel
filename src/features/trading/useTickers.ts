import { useEffect, useState } from 'react'
import { fetchTickers } from '../../lib/market/binance'
import { subscribeMarket } from '../../lib/market/stream'
import type { Ticker } from '../../types/market'

export function useTickers(symbols: string[]): Record<string, Ticker> {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({})
  const key = [...symbols].sort().join(',')

  useEffect(() => {
    if (key === '') return
    const list = key.split(',')
    let cancelled = false

    fetchTickers(list)
      .then((snapshot) => {
        if (cancelled) return
        setTickers((previous) => {
          const next = { ...previous }
          for (const ticker of snapshot) next[ticker.symbol] = ticker
          return next
        })
      })
      .catch(() => {
        // The realtime stream stays the primary source; a failed snapshot is not fatal.
      })

    const unsubscribes = list.map((symbol) =>
      subscribeMarket(symbol, {
        onTicker: (ticker) => {
          setTickers((previous) => ({ ...previous, [ticker.symbol]: ticker }))
        },
      }),
    )

    return () => {
      cancelled = true
      for (const unsubscribe of unsubscribes) unsubscribe()
    }
  }, [key])

  return tickers
}
