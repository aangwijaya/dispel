import { describe, expect, it } from 'vitest'
import { computeCandidateDerivatives, computeDerivatives, type DerivativesInput } from './derivatives.ts'

const HOUR = 3_600_000
const NOW = Date.parse('2026-09-30T12:00:00.000Z')

function hourly(values: number[]): Array<{ time: number; openInterestUsd: number }> {
  return values.map((value, index) => ({ time: NOW - (values.length - 1 - index) * HOUR, openInterestUsd: value }))
}

function baseInput(): DerivativesInput {
  return {
    asOf: new Date(NOW).toISOString(),
    binance: {
      btc: {
        premium: { lastFundingRate: 0.0001, markPrice: 100_000 },
        openInterest: 1000,
        history: hourly(Array.from({ length: 25 }, (_, index) => 10_000_000_000 * (1 + index * 0.001))),
      },
      eth: {
        premium: { lastFundingRate: 0.00005, markPrice: 4000 },
        openInterest: 5000,
        history: hourly(Array.from({ length: 25 }, (_, index) => 5_000_000_000 * (1 + index * 0.0005))),
      },
    },
    gate: {
      btc: {
        contract: { fundingRate8h: 0.0001, markPrice: 100_000, openInterestUsd: 2_000_000_000 },
        stats: [
          { time: (NOW - 23 * HOUR) / 1000, openInterestUsd: 1_800_000_000, longLiqUsd: 1_000_000, shortLiqUsd: 200_000, lsrAccount: 1.4 },
          { time: NOW / 1000, openInterestUsd: 2_000_000_000, longLiqUsd: 3_000_000, shortLiqUsd: 500_000, lsrAccount: 1.5 },
        ],
      },
    },
    hyperliquid: {
      contexts: [{ coin: 'BTC', fundingHourly: 0.00002, openInterestCoins: 100, markPx: 100_000 }],
      funding: {
        btc: Array.from({ length: 25 }, (_, index) => ({ time: NOW - (24 - index) * HOUR, rateHourly: 0.00002 })),
      },
    },
    priceHistory1h: {
      btc: Array.from({ length: 25 }, (_, index) => 100 * (1 + index * 0.001)),
      eth: Array.from({ length: 25 }, (_, index) => 4_000 * (1 + index * 0.0005)),
    },
    change24hPct: { btc: 2.4, eth: 1.2 },
    previous: { oiUsd: [], funding: [] },
  }
}

describe('computeDerivatives', () => {
  it('aggregates funding, OI and liquidations across venues', () => {
    const facts = computeDerivatives(baseInput())
    expect(facts).not.toBeNull()
    if (!facts) return
    expect(facts.venues_answered).toEqual(['binance_futures', 'gate_futures', 'hyperliquid'])
    expect(facts.venues_failed).toEqual([])

    const funding = facts.funding.btc
    expect(funding?.by_venue_8h_pct).toEqual({
      binance_futures: 0.01,
      gate_futures: 0.01,
      hyperliquid: 0.016,
    })
    expect(funding?.current_8h_pct).toBeCloseTo(0.0101, 3)
    expect(funding?.avg_24h_8h_pct).toBeCloseTo(0.016, 3)

    expect(facts.open_interest_usd.btc).toBe(12_250_000_000)
    expect(facts.oi_change_pct.btc?.['1h']).toBeCloseTo(0.1, 2)
    expect(facts.oi_change_pct.btc?.['24h']).toBeCloseTo(2.4, 1)
    expect(facts.liquidations_24h_usd.btc).toEqual({ long: 4_000_000, short: 700_000 })
    expect(facts.long_short_account_ratio.btc).toBe(1.5)
    expect(facts.price_change_pct.btc?.['24h']).toBeCloseTo(2.4, 2)
  })

  it('keeps working when Binance is missing and falls back to stored snapshots', () => {
    const input = baseInput()
    input.binance = {}
    input.gate.btc = {
      contract: { fundingRate8h: 0.0002, markPrice: 100_000, openInterestUsd: 2_000_000_000 },
      stats: input.gate.btc?.stats ?? [],
    }
    input.previous = {
      oiUsd: [
        { asOf: new Date(NOW - 1 * HOUR).toISOString(), openInterestUsd: { btc: 1_980_000_000 } },
        { asOf: new Date(NOW - 24 * HOUR).toISOString(), openInterestUsd: { btc: 1_900_000_000 } },
      ],
      funding: [{ asOf: new Date(NOW - 15 * 60_000).toISOString(), funding: { btc: { current_8h_pct: 0.018, avg_24h_8h_pct: 0.018, by_venue_8h_pct: {} } } }],
    }

    const facts = computeDerivatives(input)
    expect(facts).not.toBeNull()
    if (!facts) return
    expect(facts.venues_failed).toContain('binance_futures')
    expect(facts.venues_answered).toContain('gate_futures')
    expect(facts.open_interest_usd.btc).toBeGreaterThan(0)
    expect(facts.oi_change_pct.btc?.['1h']).toBeCloseTo(1.5, 1)
    expect(facts.oi_change_pct.btc?.['24h']).toBeCloseTo(11.1, 1)
  })

  it('returns null when every venue failed', () => {
    const input = baseInput()
    input.binance = {}
    input.gate = {}
    input.hyperliquid = { contexts: [], funding: {} }
    expect(computeDerivatives(input)).toBeNull()
  })
})

describe('computeCandidateDerivatives', () => {
  it('builds per-candidate facts from Binance history', () => {
    const facts = computeCandidateDerivatives({
      binance: {
        premium: { lastFundingRate: 0.0001, markPrice: 200 },
        openInterest: 1000,
        history: hourly(Array.from({ length: 25 }, (_, index) => 100_000_000 * (1 + index * 0.002))),
      },
      priceHistory1h: Array.from({ length: 25 }, (_, index) => 200 * (1 + index * 0.001)),
      change24hPct: 2.5,
      previousOiUsd: [],
      asOf: new Date(NOW).toISOString(),
    })
    expect(facts?.funding_8h_pct).toBeCloseTo(0.01, 4)
    expect(facts?.oi_change_1h_pct).toBeCloseTo(0.2, 1)
    expect(facts?.price_change_24h_pct).toBeCloseTo(2.4, 2)
  })

  it('returns null without any derivatives data', () => {
    expect(
      computeCandidateDerivatives({
        priceHistory1h: [],
        change24hPct: null,
        previousOiUsd: [],
        asOf: new Date(NOW).toISOString(),
      }),
    ).toBeNull()
  })
})
