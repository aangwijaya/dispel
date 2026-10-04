import type { Candle } from './types.ts'

export function atrSeries(candles: Candle[], period = 14): number[] {
  const out: number[] = new Array(candles.length).fill(0)
  if (candles.length <= period) return out
  const trueRange = (i: number): number => {
    const candle = candles[i]
    const prev = candles[i - 1]
    if (!candle || !prev) return 0
    return Math.max(candle.high - candle.low, Math.abs(candle.high - prev.close), Math.abs(candle.low - prev.close))
  }
  let sum = 0
  for (let i = 1; i <= period; i++) sum += trueRange(i)
  let atr = sum / period
  out[period] = atr
  for (let i = period + 1; i < candles.length; i++) {
    atr = (atr * (period - 1) + trueRange(i)) / period
    out[i] = atr
  }
  return out
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

export function swings(candles: Candle[], k = 2): { highs: number[]; lows: number[] } {
  const highs: number[] = []
  const lows: number[] = []
  for (let i = k; i < candles.length - k; i++) {
    const candle = candles[i]
    if (!candle) continue
    let isHigh = true
    let isLow = true
    for (let j = 1; j <= k; j++) {
      const left = candles[i - j]
      const right = candles[i + j]
      if (!left || !right) continue
      if (candle.high <= left.high || candle.high <= right.high) isHigh = false
      if (candle.low >= left.low || candle.low >= right.low) isLow = false
    }
    if (isHigh) highs.push(candle.high)
    if (isLow) lows.push(candle.low)
  }
  return { highs, lows }
}

export function trendLabel(highs: number[], lows: number[]): string {
  const h = highs.slice(-2)
  const l = lows.slice(-2)
  if (h.length === 2 && l.length === 2) {
    const h0 = h[0] ?? 0
    const h1 = h[1] ?? 0
    const l0 = l[0] ?? 0
    const l1 = l[1] ?? 0
    if (h1 > h0 && l1 > l0) return 'higher highs and higher lows'
    if (h1 < h0 && l1 < l0) return 'lower highs and lower lows'
  }
  return 'range-bound, no clear structure'
}

export function volumeRatio(candles: Candle[], lookback = 20): number {
  if (candles.length < lookback + 1) return 1
  const last = candles.at(-1)?.volume ?? 0
  const mean =
    candles
      .slice(-lookback - 1, -1)
      .reduce((total, candle) => total + candle.volume, 0) / lookback
  return mean > 0 ? last / mean : 1
}

export function round(value: number, dp: number): number {
  const factor = 10 ** dp
  return Math.round(value * factor) / factor
}

export function anchorsFrom(candles: Candle[], count = 10): number[] {
  if (candles.length === 0) return []
  if (candles.length <= count) return candles.map((candle) => candle.close)
  const out: number[] = []
  const step = (candles.length - 1) / (count - 1)
  for (let i = 0; i < count; i++) {
    out.push(candles[Math.round(i * step)]?.close ?? 0)
  }
  return out
}

export function seedFrom(symbol: string): number {
  let hash = 7
  for (const char of symbol) {
    hash = (hash * 31 + char.charCodeAt(0)) % 97
  }
  return hash === 0 ? 1 : hash
}
