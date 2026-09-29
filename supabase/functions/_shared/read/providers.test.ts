import { describe, expect, it } from 'vitest'
import {
  parseBinanceOiHistory,
  parseBinanceOpenInterest,
  parseBinancePremiumIndex,
  parseCoinMetrics,
  parseDefiLlamaStablecoins,
  parseGateContract,
  parseGateStats,
  parseHyperliquidFunding,
  parseHyperliquidMeta,
  parseMempoolFees,
  parseMempoolStats,
} from './marketData.ts'

describe('binance futures parsers', () => {
  it('parses premium index and open interest', () => {
    expect(
      parseBinancePremiumIndex({ symbol: 'BTCUSDT', lastFundingRate: '0.00010000', markPrice: '63000.5' }),
    ).toEqual({ lastFundingRate: 0.0001, markPrice: 63000.5 })
    expect(parseBinanceOpenInterest({ openInterest: '79856.972' })).toBeCloseTo(79856.972, 3)
    expect(parseBinancePremiumIndex({ lastFundingRate: 'x' })).toBeNull()
    expect(parseBinanceOpenInterest({})).toBeNull()
  })

  it('parses OI history sorted by time and drops bad rows', () => {
    const points = parseBinanceOiHistory([
      { timestamp: 2000, sumOpenInterestValue: '120' },
      { timestamp: 1000, sumOpenInterestValue: '100' },
      { timestamp: 3000, sumOpenInterestValue: 'x' },
    ])
    expect(points).toEqual([
      { time: 1000, openInterestUsd: 100 },
      { time: 2000, openInterestUsd: 120 },
    ])
  })
})

describe('gate futures parsers', () => {
  it('normalises funding to 8h and computes OI in USD', () => {
    const contract = parseGateContract({
      funding_rate: '0.0001',
      funding_interval: 14_400,
      mark_price: '100',
      open_interest: '50',
      quanto_multiplier: '0.01',
    })
    expect(contract?.fundingRate8h).toBeCloseTo(0.0002, 8)
    expect(contract?.openInterestUsd).toBeCloseTo(50, 6)
    expect(parseGateContract({ funding_rate: '0.0001', funding_interval: 0, mark_price: '100' })).toBeNull()
  })

  it('prefers the direct open_interest_usd field', () => {
    const contract = parseGateContract({
      funding_rate: '0',
      funding_interval: 28_800,
      mark_price: '100',
      open_interest_usd: 12_345,
    })
    expect(contract?.openInterestUsd).toBe(12_345)
  })

  it('parses contract stats', () => {
    const stats = parseGateStats([
      { time: 2000, open_interest_usd: 200, long_liq_usd: 10, short_liq_usd: 2, lsr_account: 1.4 },
      { time: 1000, open_interest_usd: 100 },
    ])
    expect(stats).toHaveLength(2)
    expect(stats[0]?.time).toBe(1000)
    expect(stats[1]).toMatchObject({ openInterestUsd: 200, longLiqUsd: 10, shortLiqUsd: 2, lsrAccount: 1.4 })
  })
})

describe('hyperliquid parsers', () => {
  it('parses meta and asset contexts by index', () => {
    const contexts = parseHyperliquidMeta([
      { universe: [{ name: 'BTC' }, { name: 'ETH' }] },
      [{ funding: '0.00001', openInterest: '10', markPx: '100' }, { funding: '0.00002', openInterest: '5', markPx: '50' }],
    ])
    expect(contexts).toHaveLength(2)
    expect(contexts[0]).toMatchObject({ coin: 'BTC', fundingHourly: 0.00001, markPx: 100 })
  })

  it('parses funding history sorted by time', () => {
    const history = parseHyperliquidFunding([
      { time: 2000, fundingRate: '0.00002' },
      { time: 1000, fundingRate: '0.00001' },
    ])
    expect(history.map((point) => point.time)).toEqual([1000, 2000])
  })
})

describe('coin metrics parser', () => {
  it('converts metric strings and skips flash rows', () => {
    const days = parseCoinMetrics({
      data: [
        { asset: 'btc', time: '2026-09-28T00:00:00.000Z', FlowInExNtv: '10', FlowOutExNtv: '12', SplyExNtv: '100', AdrActCnt: '900' },
        { asset: 'btc', time: '2026-09-29T00:00:00.000Z', '-status': 'flash', FlowInExNtv: '11' },
      ],
    })
    expect(days).toHaveLength(1)
    expect(days[0]?.values.FlowInExNtv).toBe(10)
    expect(days[0]?.date).toBe('2026-09-28')
  })

  it('rejects non-object payloads', () => {
    expect(parseCoinMetrics(null)).toEqual([])
  })
})

describe('defillama parser', () => {
  it('reads peggedUSD totals from both shapes and unix dates', () => {
    const rows = parseDefiLlamaStablecoins([
      { date: '1511913600', totalCirculatingUSD: { peggedUSD: 100 } },
      { date: '2026-09-28', total: { peggedUSD: 110 } },
      { date: '2026-09-29', total: 120 },
    ])
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({ date: '2017-11-29', totalUsd: 100 })
    expect(rows[2]).toEqual({ date: '2026-09-29', totalUsd: 120 })
  })
})

describe('mempool parsers', () => {
  it('reads fees and stats', () => {
    expect(parseMempoolFees({ fastestFee: 9 })).toBe(9)
    expect(parseMempoolStats({ count: 41000 })).toBe(41000)
    expect(parseMempoolFees({})).toBeNull()
    expect(parseMempoolStats([])).toBeNull()
  })
})
