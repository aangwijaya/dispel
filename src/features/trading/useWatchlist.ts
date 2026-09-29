import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { friendlyDbError } from '../../lib/errors'

export interface Watchlist {
  symbols: string[]
  error: string | null
  toggle: (symbol: string) => Promise<void>
}

export function useWatchlist(userId: string): Watchlist {
  const [symbols, setSymbols] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

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
        const next: string[] = []
        for (const row of data) {
          const symbol = (row as { symbol?: unknown }).symbol
          if (typeof symbol === 'string') next.push(symbol)
        }
        setSymbols(next)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const toggle = useCallback(
    async (symbol: string) => {
      const watched = symbols.includes(symbol)
      setError(null)
      setSymbols((previous) =>
        watched ? previous.filter((item) => item !== symbol) : [...previous, symbol],
      )

      const { error: writeError } = watched
        ? await supabase.from('watchlist_items').delete().eq('user_id', userId).eq('symbol', symbol)
        : await supabase.from('watchlist_items').insert({ user_id: userId, symbol })

      if (writeError) {
        setSymbols((previous) =>
          watched ? [...previous, symbol] : previous.filter((item) => item !== symbol),
        )
        setError(friendlyDbError(writeError.message))
      }
    },
    [symbols, userId],
  )

  return { symbols, error, toggle }
}
