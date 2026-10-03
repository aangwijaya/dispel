import { describe, expect, it } from 'vitest'
import { mapAnswers } from './answers.ts'
import { composeRead } from './compose.ts'
import { collectCopy, findC4Violations } from './__fixtures__/c4.ts'
import { candidateAnswers, choice, makeResponse, marketAnswers, score } from './__fixtures__/answers.ts'
import { mockCandidate, mockFacts, previousRead } from './__fixtures__/mock.ts'
import type { ComposeInput, DerivativesFacts, MarketFacts, OnchainFacts, ReadPayload } from './types.ts'

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

function composeFixture(
  previousReads: ComposeInput['previousReads'] = [],
  extra: Partial<ComposeInput> = {},
): ReadPayload {
  const facts = fixtureFacts()
  const sol = mockCandidate('SOL', '15m-1h')
  const link = mockCandidate('LINK', '1h-4h', { pattern: 'momentum_turn' })
  const answers = makeResponse({
    ...marketAnswers({
      stance: choice('favorable', 0.9),
      regime: choice('constructive', 0.8),
      bias: choice('bullish', 0.9),
    }),
    positioning: choice('crowded_long', 0.8),
    onchain_alignment: choice('supports', 0.8),
    ...candidateAnswers('SOL'),
    ...candidateAnswers('LINK', { type: 'momentum_turn' }),
  })
  const mapped = mapAnswers(answers, [sol, link])
  return composeRead({ asOf: AS_OF, facts, candidates: [], mapped, previousReads, ...extra })
}

const DERIVATIVES: DerivativesFacts = {
  as_of_utc: AS_OF,
  venues_answered: ['gate_futures'],
  venues_failed: ['binance_futures', 'hyperliquid'],
  funding: { btc: { current_8h_pct: -0.01, avg_24h_8h_pct: 0.005, by_venue_8h_pct: { gate_futures: -0.01 } } },
  open_interest_usd: { btc: 12_000_000_000 },
  oi_change_pct: { btc: { '1h': 6.2, '4h': 2, '24h': 1 } },
  price_change_pct: { btc: { '1h': 0.2, '4h': 0.4, '24h': 1.2 } },
  liquidations_24h_usd: { btc: { long: 60_000_000, short: 5_000_000 } },
  long_short_account_ratio: { btc: 1.4 },
}

function onchainFacts(date: string, netflow: number): OnchainFacts {
  return {
    as_of_date: date,
    btc: {
      netflow_ntv_today: netflow,
      netflow_ntv_7d_sum: netflow * 6,
      netflow_today_vs_30d_avg_pct: -150,
      exchange_supply_30d_change_pct: -1.2,
      active_addresses_vs_30d_avg_pct: 4,
    },
    eth: {
      netflow_ntv_today: netflow,
      netflow_ntv_7d_sum: netflow * 5,
      netflow_today_vs_30d_avg_pct: -120,
      exchange_supply_30d_change_pct: -0.5,
      active_addresses_vs_30d_avg_pct: 2,
    },
    stablecoin_supply_usd: 160_000_000_000,
    stablecoin_supply_7d_change_pct: 0.5,
    stablecoin_supply_30d_change_pct: 2.1,
    btc_mempool: { tx_count: 41_000, fastest_fee_sat_vb: 9, fastest_fee_vs_7d_median_pct: -20 },
  }
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
    expect(payload.evidence).toHaveLength(8)
    expect(payload.evidence.map((well) => well.label)).toEqual([
      'Trend',
      'Momentum',
      'Volume',
      'Volatility',
      'Breadth',
      'Levels',
      'Positioning',
      'On-chain',
    ])
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

  it('publishes the stance split, raised risk and judged time when uncertain or partial', () => {
    const mapped = mapAnswers(
      makeResponse(
        marketAnswers({
          stance: choice('wait', 0.21, { wait: 0.41, favorable: 0.37, unclear: 0.12, reduce_risk: 0.1 }),
          risk: { ...score(1.43, 0.35, 3), probabilities: { '0': 0, '1': 0.57, '2': 0.43 } },
        }),
      ),
      [],
    )
    const payload = composeRead({
      asOf: AS_OF,
      judgedAt: '2026-09-28T14:15:00.000Z',
      facts: fixtureFacts(),
      candidates: [],
      mapped,
      previousReads: [],
    })
    expect(payload.stats.confidence).toBe(0)
    expect(payload.stats.split).toEqual([
      { stance: 'wait', pct: 41 },
      { stance: 'favorable', pct: 37 },
    ])
    expect(payload.stats.risk).toBe(2)
    expect(payload.stats.riskRaisedPct).toBe(43)
    expect(payload.judgedTime).toBe('14:15 UTC')
  })

  it('leaves the split and raised risk out of a confident read', () => {
    const payload = composeFixture()
    expect(payload.stats.split).toBeUndefined()
    expect(payload.stats.riskRaisedPct).toBeUndefined()
    expect(payload.judgedTime).toBeUndefined()
  })

  it('keeps every user-facing string inside the DESIGN C4 voice', () => {
    const payload = composeFixture([previousRead({ regimeIndex: 1 })])
    expect(findC4Violations(collectCopy(payload))).toEqual([])
  })

  it('marks the new wells unavailable when the sources did not answer', () => {
    const payload = composeFixture()
    const positioning = payload.evidence.find((well) => well.label === 'Positioning')
    const onchain = payload.evidence.find((well) => well.label === 'On-chain')
    expect(positioning?.state).toBe('Unavailable')
    expect(onchain?.state).toBe('Unavailable')
  })

  it('wires derivatives and on-chain facts into the wells and events', () => {
    const previousInputs: ComposeInput['previousInputs'] = [
      { asOf: '2026-09-28T14:15:00.000Z', derivatives: null, onchain: onchainFacts('2026-09-26', -900) },
      { asOf: '2026-09-29T14:15:00.000Z', derivatives: null, onchain: onchainFacts('2026-09-27', -800) },
      {
        asOf: '2026-09-29T23:00:00.000Z',
        derivatives: {
          ...DERIVATIVES,
          funding: { btc: { current_8h_pct: 0.012, avg_24h_8h_pct: 0.01, by_venue_8h_pct: { gate_futures: 0.012 } } },
        },
        onchain: onchainFacts('2026-09-28', -700),
      },
    ]
    const payload = composeFixture([], {
      derivatives: DERIVATIVES,
      onchain: onchainFacts('2026-09-29', -1250),
      previousInputs,
    })

    const positioning = payload.evidence.find((well) => well.label === 'Positioning')
    expect(positioning?.state).toBe('Crowded long')
    expect(positioning?.detail).toContain('BTC funding')
    const onchain = payload.evidence.find((well) => well.label === 'On-chain')
    expect(onchain?.state).toBe('Supports')
    expect(onchain?.detail).toContain('as of Sep 29')

    const kinds = payload.changes.map((event) => event.text)
    expect(kinds.some((text) => text.includes('Funding flipped negative'))).toBe(true)
    expect(kinds.some((text) => text.includes('open interest') && text.includes('last hour'))).toBe(true)
    expect(kinds.some((text) => text.includes('liquidations in 24h'))).toBe(true)
    expect(kinds.some((text) => text.includes('exchange outflows for 4 straight days'))).toBe(true)
    expect(findC4Violations(collectCopy(payload))).toEqual([])
  })
})
