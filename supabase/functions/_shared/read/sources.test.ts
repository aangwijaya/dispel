import { describe, expect, it } from 'vitest'
import {
  COINMETRICS_MARKET_METRICS,
  PROBE_SOURCES,
  coinmetricsMetricsUrl,
  gateContract,
  hyperliquidFundingHistoryBody,
} from './sources.ts'

describe('sources', () => {
  it('lists every Phase 6 source once', () => {
    expect(PROBE_SOURCES.map((source) => source.id).sort()).toEqual([
      'binance_futures',
      'coinmetrics',
      'defillama',
      'gate_futures',
      'hyperliquid',
      'mempool',
    ])
  })

  it('defines https checks with a method and JSON bodies where needed', () => {
    for (const source of PROBE_SOURCES) {
      expect(source.checks.length).toBeGreaterThan(0)
      for (const check of source.checks) {
        expect(check.url.startsWith('https://')).toBe(true)
        expect(['GET', 'POST']).toContain(check.method)
        if (check.method === 'POST') expect(typeof check.body).toBe('function')
      }
    }
  })

  it('maps symbols and builds provider URLs', () => {
    expect(gateContract('BTC')).toBe('BTC_USDT')
    const url = coinmetricsMetricsUrl(['btc', 'eth'], COINMETRICS_MARKET_METRICS)
    expect(url).toContain('assets=btc%2Ceth')
    expect(url).toContain('FlowInExNtv')
    const body = hyperliquidFundingHistoryBody('BTC', 1_700_000_000_000) as Record<string, unknown>
    expect(body.type).toBe('fundingHistory')
    expect(body.coin).toBe('BTC')
    expect(body.startTime).toBe(1_700_000_000_000)
  })
})
