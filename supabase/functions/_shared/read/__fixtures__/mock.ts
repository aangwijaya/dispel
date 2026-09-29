import { MARKETS } from '../../../../../src/lib/markets.ts'
import type { Candidate, MarketFacts, PreviousReadSummary, Ticker } from '../types.ts'
import { candlesFromCloses } from './candles.ts'

export function mockTicker(symbol: string, overrides?: Partial<Ticker>): Ticker {
  return {
    symbol,
    lastPrice: '100',
    changePercent: '0.5',
    highPrice: '102',
    lowPrice: '98',
    volume: '1000',
    quoteVolume: '100000',
    ...overrides,
  }
}

export function mockFacts(symbol: string, overrides?: Partial<MarketFacts>): MarketFacts {
  const market = MARKETS.find((item) => item.symbol === symbol)
  if (!market) throw new Error(`fixture market missing: ${symbol}`)
  const closes = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 6) * 1.5)
  const candles4h = candlesFromCloses(closes)
  const hourly = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 6) * 0.8)
  return {
    market,
    candles4h,
    candles1h: candlesFromCloses(hourly),
    last: 100,
    change24h: 0.5,
    trend4h: 'range-bound, no clear structure',
    rsi1h: 50,
    atr4h: 1,
    atrRatio: 1,
    nearestResistance: 102,
    nearestSupport: 98,
    volVs7dPct: 0,
    aboveEma50: true,
    ...overrides,
  }
}

export function mockCandidate(symbol: string, horizon: string, overrides?: Partial<Candidate>): Candidate {
  const facts = mockFacts(`${symbol}USDT`)
  return {
    marketSymbol: facts.market.symbol,
    symbol,
    pattern: 'breakout_retest',
    direction: 'long',
    level: 101,
    invalidation: 99,
    target: 105,
    horizon,
    volumeRatio: 1.4,
    retests: 1,
    score: 3,
    factsText: 'Fixture setup.',
    rsi15m: 55,
    anchors: [98, 99, 100, 101, 100.5, 101.5],
    seed: 7,
    facts,
    ...overrides,
  }
}

export function previousRead(overrides?: Partial<PreviousReadSummary>): PreviousReadSummary {
  return {
    asOf: '2026-09-28T13:00:00.000Z',
    regimeIndex: 2,
    stance: 'wait',
    volatility: 1,
    setups: [],
    ...overrides,
  }
}
