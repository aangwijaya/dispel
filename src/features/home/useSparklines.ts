import { useEffect, useState } from 'react'
import { fetchKlines } from '../../lib/market/binance'

export function useSparklines(symbols: string[]): Record<string, number[]> {
  const [lines, setLines] = useState<Record<string, number[]>>({})
  const key = [...symbols].sort().join(',')

  useEffect(() => {
    if (key === '') return
    let cancelled = false
    const list = key.split(',')

    Promise.all(
      list.map((symbol) =>
        fetchKlines(symbol, '1h')
          .then((candles) => [symbol, candles.slice(-24).map((candle) => candle.close)] as const)
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return
      setLines((previous) => {
        const next = { ...previous }
        for (const result of results) {
          if (result) next[result[0]] = result[1]
        }
        return next
      })
    })

    return () => {
      cancelled = true
    }
  }, [key])

  return lines
}
