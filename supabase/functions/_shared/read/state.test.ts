import { describe, expect, it } from 'vitest'
import { buildState, candidateState } from './state.ts'
import { mockCandidate, mockFacts, mockTicker, previousRead } from './__fixtures__/mock.ts'
import type { MarketFacts } from './types.ts'

const AS_OF = '2026-09-28T14:30:00.000Z'

function fixtureFacts(): MarketFacts[] {
  return [
    mockFacts('BTCUSDT', {
      last: 105000,
      change24h: 1.2,
      trend4h: 'higher highs and higher lows',
      rsi1h: 58,
      atrRatio: 1.1,
      nearestResistance: 106000,
      nearestSupport: 103000,
      volVs7dPct: 10,
      aboveEma50: true,
    }),
    mockFacts('ETHUSDT', {
      last: 4600,
      change24h: -0.4,
      rsi1h: 47,
      atrRatio: 0.95,
      nearestResistance: 4660,
      nearestSupport: 4540,
      volVs7dPct: -5,
      aboveEma50: false,
    }),
  ]
}

describe('buildState', () => {
  it('summarises breadth and major facts', () => {
    const facts = fixtureFacts()
    const candidates = [mockCandidate('BNB', '15m-1h')]
    const state = buildState({
      asOf: AS_OF,
      facts,
      tickers: [
        mockTicker('BTCUSDT', { changePercent: '1.2' }),
        mockTicker('ETHUSDT', { changePercent: '-0.4' }),
      ],
      previousRead: null,
      candidates,
      rsi15mBySymbol: { BNB: 61 },
    })
    expect(state.universe).toBe('2 Binance USDT spot pairs')
    expect(state.previous_read).toBeNull()
    expect(state.breadth.up_24h).toBe(1)
    expect(state.breadth.down_24h).toBe(1)
    expect(state.breadth.above_ema50_4h).toBe(1)
    expect(state.btc.trend_4h).toBe('higher highs and higher lows')
    expect(state.candidates.BNB?.rsi_15m).toBe(61)
  })

  it('carries the previous read with its age', () => {
    const state = buildState({
      asOf: AS_OF,
      facts: fixtureFacts(),
      tickers: [mockTicker('BTCUSDT', { changePercent: '1.2' }), mockTicker('ETHUSDT', { changePercent: '-0.4' })],
      previousRead: previousRead({ asOf: '2026-09-28T14:15:00.000Z', regimeIndex: 3, stance: 'favorable' }),
      candidates: [],
      rsi15mBySymbol: {},
    })
    expect(state.previous_read).toEqual({ stance: 'favorable', regime: 'constructive', age_minutes: 15 })
  })

  it('requires BTC and ETH facts', () => {
    expect(() =>
      buildState({
        asOf: AS_OF,
        facts: [mockFacts('SOLUSDT')],
        tickers: [],
        previousRead: null,
        candidates: [],
        rsi15mBySymbol: {},
      }),
    ).toThrow('state requires BTC and ETH facts')
  })
})

describe('candidateState', () => {
  it('rounds numbers and omits a missing 15m RSI', () => {
    const candidate = mockCandidate('SOL', '15m-1h')
    const withRsi = candidateState(candidate, 58.44)
    expect(withRsi.rsi_15m).toBe(58.4)
    const withoutRsi = candidateState(candidate, null)
    expect('rsi_15m' in withoutRsi).toBe(false)
  })
})
