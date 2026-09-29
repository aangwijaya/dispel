import { describe, expect, it } from 'vitest'
import { mapAnswers } from './answers.ts'
import { composeRead } from './compose.ts'
import { collectCopy, findC4Violations } from './__fixtures__/c4.ts'
import { candidateAnswers, choice, makeResponse, marketAnswers } from './__fixtures__/answers.ts'
import { mockCandidate, mockFacts, previousRead } from './__fixtures__/mock.ts'
import type { ComposeInput, MarketFacts, ReadPayload } from './types.ts'

const AS_OF = '2026-09-28T14:30:00.000Z'

const MARKET_WIDE_KEYS = [
  'bias',
  'biasLine',
  'biasTone',
  'breadth',
  'caution',
  'changes',
  'coverage',
  'evidence',
  'explainLead',
  'explainRest',
  'forming',
  'regimeIndex',
  'ribbon',
  'setups',
  'shift',
  'stance',
  'stats',
  'tags',
  'time',
  'verdict',
]

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
      volVs7dPct: 24,
      aboveEma50: true,
    }),
    mockFacts('ETHUSDT', { last: 4600, change24h: 0.4, rsi1h: 54, atrRatio: 1.0 }),
    mockFacts('SOLUSDT', { last: 210, change24h: 3.4, trend4h: 'higher highs and higher lows', rsi1h: 61, aboveEma50: true }),
    mockFacts('LINKUSDT', { last: 24.6, change24h: 5.2, rsi1h: 63, aboveEma50: true }),
  ]
}

function composeFixture(previousReads: ComposeInput['previousReads'] = []): ReadPayload {
  const facts = fixtureFacts()
  const sol = mockCandidate('SOL', '15m-1h')
  const link = mockCandidate('LINK', '1h-4h', { pattern: 'momentum_turn' })
  const answers = makeResponse({
    ...marketAnswers({
      stance: choice('favorable', 0.9),
      regime: choice('constructive', 0.8),
      bias: choice('bullish', 0.9),
    }),
    ...candidateAnswers('SOL'),
    ...candidateAnswers('LINK', { type: 'momentum_turn' }),
  })
  const mapped = mapAnswers(answers, [sol, link])
  return composeRead({ asOf: AS_OF, facts, candidates: [], mapped, previousReads })
}

describe('composeRead', () => {
  it('emits exactly the market-wide fields of MarketRead', () => {
    const payload = composeFixture()
    expect(Object.keys(payload).sort()).toEqual(MARKET_WIDE_KEYS)
  })

  it('fills verdict, stats, evidence and breadth', () => {
    const payload = composeFixture()
    expect(['Look for setups', 'Be selective', 'Wait.', 'No clear read', 'Reduce risk']).toContain(payload.verdict)
    expect(payload.coverage).toBe('4 markets')
    expect(payload.breadth.up + payload.breadth.down).toBe(4)
    expect(payload.stats.strength).toBeGreaterThanOrEqual(0)
    expect(payload.stats.strength).toBeLessThanOrEqual(100)
    expect(payload.evidence).toHaveLength(6)
    expect(payload.caution.length).toBeGreaterThan(0)
    expect(payload.tags.BTC).toBeDefined()
    expect(payload.tags.SOL?.label).toBe('Setup')
  })

  it('keeps setups ordered by horizon and marks new ones', () => {
    const payload = composeFixture([previousRead({ setups: [{ symbol: 'LINK', type: 'momentum_turn' }] })])
    expect(payload.setups.map((setup) => setup.monogram)).toEqual(['SOL', 'LINK'])
    expect(payload.setups[0]?.isNew).toBe(true)
    expect(payload.setups[1]?.isNew).toBeUndefined()
  })

  it('builds a regime shift and setup changes against the previous read', () => {
    const payload = composeFixture([previousRead({ regimeIndex: 1 })])
    expect(payload.shift).not.toBeNull()
    expect(payload.changes.some((event) => event.kind === 'shift')).toBe(true)
    expect(payload.changes.some((event) => event.text.startsWith('Setup added'))).toBe(true)
  })

  it('reports no shift when the regime is unchanged', () => {
    const payload = composeFixture([previousRead({ regimeIndex: 3 })])
    expect(payload.shift).toBeNull()
  })

  it('maps the reduce-risk stance to the hyphenated UI value', () => {
    const facts = fixtureFacts()
    const sol = mockCandidate('SOL', '15m-1h')
    const mapped = mapAnswers(
      makeResponse({
        ...marketAnswers({ stance: choice('reduce_risk', 0.9) }),
        ...candidateAnswers('SOL', { worth: 0.2 }),
      }),
      [sol],
    )
    const payload = composeRead({ asOf: AS_OF, facts, candidates: [], mapped, previousReads: [] })
    expect(payload.stance).toBe('reduce-risk')
    expect(payload.verdict).toBe('Reduce risk')
  })

  it('keeps every user-facing string inside the DESIGN C4 voice', () => {
    const payload = composeFixture([previousRead({ regimeIndex: 1 })])
    expect(findC4Violations(collectCopy(payload))).toEqual([])
  })
})
