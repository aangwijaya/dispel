import type { Candle } from '../types.ts'

export const HOUR = 3600
export const FOUR_HOURS = 4 * HOUR

export interface Scenario {
  candles4h: Candle[]
  candles1h: Candle[]
}

export function candlesFromCloses(
  closes: number[],
  options?: {
    step?: number
    start?: number
    volumeBase?: number
    spread?: number
    volumeOverrides?: Record<number, number>
  },
): Candle[] {
  const step = options?.step ?? FOUR_HOURS
  const start = options?.start ?? 1_700_000_000
  const spread = options?.spread ?? 0.001
  const base = options?.volumeBase ?? 100
  return closes.map((close, index) => {
    const open = closes[index - 1] ?? close
    const jitter = ((index * 13) % 5) * 0.00025
    const high = Math.max(open, close) * (1 + spread + jitter)
    const low = Math.min(open, close) * (1 - spread - jitter)
    const wiggle = 0.8 + ((index * 37) % 11) / 25
    return {
      time: start + index * step,
      open,
      high,
      low,
      close,
      volume: options?.volumeOverrides?.[index] ?? base * wiggle,
    }
  })
}

export function oscillatingCloses(count: number, low: number, high: number, speed = 9): number[] {
  const mid = (high + low) / 2
  const amp = (high - low) / 2
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(mid + amp * Math.sin(i / speed))
  return out
}

/** 4h range 95–101.5, breakout above it in the last eight candles, then a retest that holds. */
export function breakoutRetestScenario(): Scenario {
  const closes = oscillatingCloses(112, 95, 101.5)
  closes.push(102.6)
  closes.push(102.05, 101.95, 102.15, 102.35, 102.25, 102.4, 102.55)
  const volumeOverrides: Record<number, number> = {}
  for (let i = 104; i < closes.length; i++) volumeOverrides[i] = i === 112 ? 320 : 130
  const candles4h = candlesFromCloses(closes, { volumeOverrides, spread: 0.0008 })
  const hourly = Array.from({ length: 168 }, (_, i) => 96 + i * 0.02 + 0.3 * Math.sin(i / 7))
  return { candles4h, candles1h: candlesFromCloses(hourly, { step: HOUR }) }
}

/** 4h range 95–101.5, a fresh breakout on heavy volume on the last candle. */
export function rangeBreakScenario(): Scenario {
  const closes = oscillatingCloses(119, 95, 101.5)
  closes.push(103.2)
  const volumeOverrides: Record<number, number> = { 119: 340 }
  const candles4h = candlesFromCloses(closes, { volumeOverrides, spread: 0.0008 })
  const hourly = Array.from({ length: 168 }, (_, i) => 96 + i * 0.02 + 0.3 * Math.sin(i / 7))
  return { candles4h, candles1h: candlesFromCloses(hourly, { step: HOUR }) }
}

/** 4h range with at least three fading tests of the high and price back below it. */
export function rejectionScenario(): Scenario {
  const closes = oscillatingCloses(119, 95, 101.5, 2.2)
  closes.push(100.6)
  const volumeOverrides: Record<number, number> = {}
  for (let i = 110; i < 119; i++) volumeOverrides[i] = 100
  volumeOverrides[116] = 45
  volumeOverrides[117] = 42
  volumeOverrides[118] = 40
  const candles4h = candlesFromCloses(closes, { volumeOverrides, spread: 0.0008 })
  const hourly = Array.from({ length: 168 }, (_, i) => 100 - i * 0.01 + 0.3 * Math.sin(i / 7))
  return { candles4h, candles1h: candlesFromCloses(hourly, { step: HOUR }) }
}

/** Long decline then a short recovery that pushes 1h RSI back above 50 near the last swing low. */
export function momentumTurnScenario(): Scenario {
  const fourHour = oscillatingCloses(112, 98.5, 100.5, 9)
  fourHour[fourHour.length - 1] = 96.9
  const hourly: number[] = []
  for (let i = 0; i < 150; i++) hourly.push(101 - i * 0.04)
  for (const close of [95.05, 95.1, 95.15, 95.2, 95.25, 95.85, 96.45, 96.9]) hourly.push(close)
  return {
    candles4h: candlesFromCloses(fourHour, { spread: 0.0008 }),
    candles1h: candlesFromCloses(hourly, { step: HOUR }),
  }
}

/** Quiet, evenly split range with no breakout and a flat hourly series. */
export function rangeBoundScenario(): Scenario {
  const closes = oscillatingCloses(120, 99, 101, 11)
  const hourly = Array.from({ length: 168 }, () => 100)
  return { candles4h: candlesFromCloses(closes, { spread: 0.0008 }), candles1h: candlesFromCloses(hourly, { step: HOUR }) }
}

/** Compressed final six candles inside a wider history, for the forming state. */
export function compressionScenario(): Scenario {
  const closes = oscillatingCloses(114, 90, 110, 8)
  closes[closes.length - 1] = 100
  closes.push(99.8, 100.0, 99.9, 100.1, 100.0, 99.95)
  const hourly = Array.from({ length: 168 }, (_, i) => 100 + 0.4 * Math.sin(i / 9))
  return { candles4h: candlesFromCloses(closes, { spread: 0.0006 }), candles1h: candlesFromCloses(hourly, { step: HOUR }) }
}
