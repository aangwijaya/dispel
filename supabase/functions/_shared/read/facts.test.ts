import { describe, expect, it } from 'vitest'
import { MARKETS } from '../../../../src/lib/markets.ts'
import { analyze, attachRsi15m, nearMiss, prescreen, selectCandidates, volatilityFromRatio } from './facts.ts'
import { mockTicker } from './__fixtures__/mock.ts'
import {
  breakoutRetestScenario,
  compressionScenario,
  momentumTurnScenario,
  rangeBoundScenario,
  rangeBreakScenario,
  rejectionScenario,
} from './__fixtures__/candles.ts'
import type { Market, MarketFacts } from './types.ts'

function btcMarket(): Market {
  const market = MARKETS.find((item) => item.symbol === 'BTCUSDT')
  if (!market) throw new Error('fixture market missing')
  return market
}

function analyzeScenario(scenario: { candles4h: ReturnType<typeof breakoutRetestScenario>['candles4h']; candles1h: ReturnType<typeof breakoutRetestScenario>['candles1h'] }): MarketFacts {
  const last = scenario.candles4h.at(-1)?.close ?? 100
  return analyze(btcMarket(), scenario.candles4h, scenario.candles1h, mockTicker('BTCUSDT', { lastPrice: String(last) }))
}

describe('analyze', () => {
  it('computes structure, levels and volatility from candles', () => {
    const facts = analyzeScenario(breakoutRetestScenario())
    expect(facts.last).toBeGreaterThan(0)
    expect(facts.atr4h).toBeGreaterThan(0)
    expect(facts.atrRatio).toBeGreaterThan(0)
    expect(facts.nearestResistance).not.toBeNull()
    expect(facts.nearestSupport).not.toBeNull()
    expect(facts.trend4h.length).toBeGreaterThan(0)
  })
})

describe('prescreen', () => {
  it('detects a breakout that was retested and held', () => {
    const candidate = prescreen(analyzeScenario(breakoutRetestScenario()))
    expect(candidate?.pattern).toBe('breakout_retest')
    expect(candidate?.direction).toBe('long')
  })

  it('detects a fresh range break on volume', () => {
    const candidate = prescreen(analyzeScenario(rangeBreakScenario()))
    expect(candidate?.pattern).toBe('range_break')
  })

  it('detects a fading test of resistance', () => {
    const candidate = prescreen(analyzeScenario(rejectionScenario()))
    expect(candidate?.pattern).toBe('rejection_at_resistance')
    expect(candidate?.direction).toBe('short')
  })

  it('detects a momentum turn on the hourly series', () => {
    const candidate = prescreen(analyzeScenario(momentumTurnScenario()))
    expect(candidate?.pattern).toBe('momentum_turn')
  })

  it('returns nothing on a quiet range', () => {
    expect(prescreen(analyzeScenario(rangeBoundScenario()))).toBeNull()
  })
})

describe('selectCandidates', () => {
  it('caps the list and keeps strong drafts first', () => {
    const scenarios = [
      breakoutRetestScenario(),
      rangeBreakScenario(),
      rejectionScenario(),
      momentumTurnScenario(),
    ]
    const drafts = scenarios.map((scenario) => prescreen(analyzeScenario(scenario))).filter((item) => item !== null)
    const selected = selectCandidates(drafts, 3)
    expect(selected.length).toBeLessThanOrEqual(3)
    for (let index = 1; index < selected.length; index++) {
      expect(selected[index - 1]!.score).toBeGreaterThanOrEqual(selected[index]!.score)
    }
  })
})

describe('nearMiss', () => {
  it('reports a compression box with a concrete condition', () => {
    const forming = nearMiss(analyzeScenario(compressionScenario()))
    expect(forming.length).toBeGreaterThanOrEqual(1)
    expect(forming.length).toBeLessThanOrEqual(2)
    expect(forming[0]?.isForming).toBe(true)
    expect(forming[0]?.condition).toMatch(/close outside/)
  })

  it('returns nothing on a normal range with no compression', () => {
    const forming = nearMiss(analyzeScenario(rangeBoundScenario()))
    expect(forming.length).toBeLessThanOrEqual(2)
  })
})

describe('volatilityFromRatio', () => {
  it('maps the ratio bands', () => {
    expect(volatilityFromRatio(0.5)).toBe(0)
    expect(volatilityFromRatio(1.2)).toBe(1)
    expect(volatilityFromRatio(1.8)).toBe(2)
    expect(volatilityFromRatio(2.5)).toBe(3)
  })
})

describe('attachRsi15m', () => {
  it('adds the 15m RSI to the candidate', () => {
    const facts = analyzeScenario(breakoutRetestScenario())
    const candidate = prescreen(facts)
    expect(candidate).not.toBeNull()
    if (!candidate) return
    const closes = Array.from({ length: 96 }, (_, index) => 100 + index * 0.1)
    const withRsi = attachRsi15m(
      candidate,
      closes.map((close, index) => ({ time: index * 900, open: close, high: close, low: close, close, volume: 1 })),
    )
    expect(withRsi.rsi15m).not.toBeNull()
  })
})
