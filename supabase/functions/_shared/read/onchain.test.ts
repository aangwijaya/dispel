import { describe, expect, it } from 'vitest'
import { computeOnchain, type OnchainInput } from './onchain.ts'
import type { CoinMetricsDay } from './marketData.ts'

const NOW = '2026-09-30T12:00:00.000Z'

function days(asset: string, count: number, options?: { inflow?: number; outflow?: number }): CoinMetricsDay[] {
  const out: CoinMetricsDay[] = []
  for (let index = 0; index < count; index++) {
    const date = new Date(Date.UTC(2026, 7, 1 + index)).toISOString().slice(0, 10)
    out.push({
      asset,
      date,
      values: {
        FlowInExNtv: options?.inflow ?? 100,
        FlowOutExNtv: options?.outflow ?? 120,
        SplyExNtv: 1_000_000 - index * 100,
        AdrActCnt: 900_000 + index * 1000,
      },
    })
  }
  return out
}

function baseInput(): OnchainInput {
  return {
    asOf: NOW,
    btcDays: days('btc', 35),
    ethDays: days('eth', 35, { inflow: 50, outflow: 40 }),
    defillama: Array.from({ length: 35 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 7, 1 + index)).toISOString().slice(0, 10),
      totalUsd: 160_000_000_000 + index * 100_000_000,
    })),
    mempool: { txCount: 41_000, fastestFee: 12 },
    previousFees: Array.from({ length: 7 }, (_, index) => ({
      asOf: new Date(Date.parse(NOW) - (index + 1) * 3_600_000).toISOString(),
      fee: 10,
    })),
  }
}

describe('computeOnchain', () => {
  it('computes netflow, supply and activity facts', () => {
    const facts = computeOnchain(baseInput())
    expect(facts).not.toBeNull()
    if (!facts) return
    expect(facts.btc.netflow_ntv_today).toBe(-20)
    expect(facts.btc.netflow_ntv_7d_sum).toBe(-140)
    expect(facts.btc.exchange_supply_30d_change_pct).toBeLessThan(0)
    expect(facts.btc.active_addresses_vs_30d_avg_pct).toBeGreaterThan(0)
    expect(facts.eth.netflow_ntv_today).toBe(10)
    expect(facts.stablecoin_supply_usd).toBe(163_400_000_000)
    expect(facts.stablecoin_supply_7d_change_pct).toBeGreaterThan(0)
    expect(facts.btc_mempool?.fastest_fee_vs_7d_median_pct).toBeCloseTo(20, 1)
  })

  it('returns null when the market metrics are missing', () => {
    const input = baseInput()
    input.btcDays = []
    expect(computeOnchain(input)).toBeNull()
  })

  it('leaves the mempool comparison null without enough stored fees', () => {
    const input = baseInput()
    input.previousFees = []
    const facts = computeOnchain(input)
    expect(facts?.btc_mempool?.fastest_fee_vs_7d_median_pct).toBeNull()
  })
})
