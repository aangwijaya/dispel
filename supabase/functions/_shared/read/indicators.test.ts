import { describe, expect, it } from 'vitest'
import { anchorsFrom, atrSeries, median, seedFrom, swings, trendLabel, volumeRatio } from './indicators.ts'
import type { Candle } from './types.ts'

function flatCandles(values: number[]): Candle[] {
  return values.map((value, index) => ({
    time: index * 3600,
    open: value,
    high: value,
    low: value,
    close: value,
    volume: 1,
  }))
}

describe('atrSeries', () => {
  it('matches a constant true range', () => {
    const candles = flatCandles(Array.from({ length: 30 }, () => 100)).map((candle) => ({
      ...candle,
      high: 101,
      low: 99,
    }))
    const atr = atrSeries(candles).at(-1) ?? 0
    expect(atr).toBeCloseTo(2, 6)
  })
})

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBe(0)
  })
})

describe('swings', () => {
  it('finds local highs and lows with a two-candle window', () => {
    const { highs, lows } = swings(flatCandles([1, 2, 4, 2, 1, 3, 5, 3, 1]), 2)
    expect(highs).toEqual([4, 5])
    expect(lows).toEqual([1])
  })
})

describe('trendLabel', () => {
  it('labels rising and falling structures', () => {
    expect(trendLabel([1, 2], [1, 2])).toBe('higher highs and higher lows')
    expect(trendLabel([2, 1], [2, 1])).toBe('lower highs and lower lows')
    expect(trendLabel([1, 2], [2, 1])).toBe('range-bound, no clear structure')
    expect(trendLabel([1], [1])).toBe('range-bound, no clear structure')
  })
})

describe('volumeRatio', () => {
  it('compares the last candle with the prior average', () => {
    const candles = flatCandles(Array.from({ length: 21 }, () => 100)).map((candle) => ({
      ...candle,
      volume: 100,
    }))
    candles[20] = { ...candles[20]!, volume: 200 }
    expect(volumeRatio(candles)).toBeCloseTo(2, 6)
  })
})

describe('anchorsFrom', () => {
  it('keeps the first and last close', () => {
    const closes = Array.from({ length: 25 }, (_, index) => 100 + index)
    const anchors = anchorsFrom(flatCandles(closes), 10)
    expect(anchors).toHaveLength(10)
    expect(anchors[0]).toBe(100)
    expect(anchors.at(-1)).toBe(124)
  })
})

describe('seedFrom', () => {
  it('is deterministic and bounded', () => {
    expect(seedFrom('BTCUSDT')).toBe(seedFrom('BTCUSDT'))
    const seed = seedFrom('SOLUSDT')
    expect(seed).toBeGreaterThanOrEqual(1)
    expect(seed).toBeLessThan(97)
  })
})
