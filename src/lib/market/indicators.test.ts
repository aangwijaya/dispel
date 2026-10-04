import { describe, expect, it } from 'vitest'
import { ema, rsi, sma } from './indicators'

// Wilder's worked example as published by StockCharts ("RSI" ChartSchool article).
const WILDER_CLOSES = [
  44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0,
  46.03, 46.41, 46.22, 45.64, 46.21, 46.25, 45.71, 46.45, 45.78, 45.35, 44.03, 44.18, 44.22, 44.57, 43.42, 42.66,
  43.13,
]
const WILDER_RSI = [
  70.53, 66.32, 66.55, 69.41, 66.36, 57.97, 62.93, 63.26, 56.06, 62.38, 54.71, 50.42, 39.99, 41.46, 41.87, 45.46,
  37.3, 33.08, 37.77,
]

describe('sma', () => {
  it('is null until the period fills, then averages the window', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
  })
})

describe('ema', () => {
  it('seeds with the SMA of the first period and is null before it', () => {
    const result = ema([1, 2, 3, 4], 3)
    expect(result.slice(0, 2)).toEqual([null, null])
    expect(result[2]).toBe(2)
    expect(result[3]).toBe(3)
  })

  it('smooths with the standard multiplier', () => {
    const result = ema([2, 4, 6, 8, 12], 2)
    expect(result[1]).toBe(3)
    expect(result[2]).toBeCloseTo(5, 10)
    expect(result[3]).toBeCloseTo(7, 10)
    expect(result[4]).toBeCloseTo(10.3333, 3)
  })

  it('returns only nulls when there is less history than the period', () => {
    expect(ema([1, 2], 5)).toEqual([null, null])
  })
})

describe('rsi', () => {
  it("matches Wilder's worked example", () => {
    const result = rsi(WILDER_CLOSES)
    expect(result.slice(0, 14).every((value) => value === null)).toBe(true)
    WILDER_RSI.forEach((expected, index) => {
      expect(Math.abs((result[14 + index] ?? 0) - expected)).toBeLessThan(0.1)
    })
  })

  it('reads 100 on a monotonic rise and 0 on a monotonic fall', () => {
    expect(rsi(Array.from({ length: 30 }, (_, index) => 100 + index)).at(-1)).toBe(100)
    expect(rsi(Array.from({ length: 30 }, (_, index) => 100 - index)).at(-1)).toBe(0)
  })

  it('is all null without enough history', () => {
    expect(rsi([1, 2, 3], 14)).toEqual([null, null, null])
  })
})
