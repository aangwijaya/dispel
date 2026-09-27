import { describe, expect, it } from 'vitest'
import { parseKlinePayload, parseTickerPayload } from './marketData.ts'

describe('parseTickerPayload', () => {
  it('keeps valid rows and drops malformed ones', () => {
    const tickers = parseTickerPayload([
      { symbol: 'BTCUSDT', lastPrice: '100', priceChangePercent: '1.5', highPrice: '102', lowPrice: '98', volume: '10', quoteVolume: '1000' },
      { symbol: 'bad', lastPrice: 'x' },
      null,
    ])
    expect(tickers).toHaveLength(1)
    expect(tickers[0]?.symbol).toBe('BTCUSDT')
  })

  it('rejects a non-array payload', () => {
    expect(() => parseTickerPayload({})).toThrow('invalid_tickers_payload')
  })
})

describe('parseKlinePayload', () => {
  it('keeps valid rows and drops malformed ones', () => {
    const candles = parseKlinePayload([
      [1_700_000_000_000, '100', '102', '99', '101', '5'],
      [1_700_003_600_000, 'x'],
    ])
    expect(candles).toHaveLength(1)
    expect(candles[0]?.close).toBe(101)
  })

  it('rejects a non-array payload', () => {
    expect(() => parseKlinePayload('nope')).toThrow('invalid_klines_payload')
  })
})
