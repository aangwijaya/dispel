import { describe, expect, it } from 'vitest'
import { sanitizeAggTrade, sanitizeKline, sanitizeOrderBook, sanitizeTicker } from './binance'

describe('sanitizeTicker', () => {
  it('accepts a REST 24h ticker payload', () => {
    const ticker = sanitizeTicker({
      symbol: 'BTCUSDT',
      lastPrice: '64000.10',
      priceChangePercent: '-1.25',
      highPrice: '65000.00',
      lowPrice: '63000.00',
      volume: '1200.5',
      quoteVolume: '76000000',
    })
    expect(ticker).toEqual({
      symbol: 'BTCUSDT',
      lastPrice: '64000.10',
      changePercent: '-1.25',
      highPrice: '65000.00',
      lowPrice: '63000.00',
      volume: '1200.5',
      quoteVolume: '76000000',
    })
  })

  it('accepts a websocket ticker payload', () => {
    const ticker = sanitizeTicker({
      e: '24hrTicker',
      s: 'ETHUSDT',
      c: '3120.55',
      P: '2.10',
      h: '3200',
      l: '3000',
      v: '5000',
      q: '15000000',
    })
    expect(ticker?.symbol).toBe('ETHUSDT')
    expect(ticker?.lastPrice).toBe('3120.55')
  })

  it('rejects malformed payloads', () => {
    expect(sanitizeTicker(null)).toBeNull()
    expect(sanitizeTicker({ symbol: 'BTCUSDT', lastPrice: 'abc' })).toBeNull()
    expect(
      sanitizeTicker({
        symbol: 'BTCUSDT',
        lastPrice: '-1',
        priceChangePercent: '0',
        highPrice: '1',
        lowPrice: '1',
        volume: '1',
        quoteVolume: '1',
      }),
    ).toBeNull()
  })
})

describe('sanitizeOrderBook', () => {
  it('maps symbol and drops invalid levels', () => {
    const book = sanitizeOrderBook(
      {
        bids: [
          ['64000.00', '0.5'],
          ['bad', '1'],
          ['63000.00', '2'],
        ],
        asks: [['64100.00', '0.25']],
      },
      'BTCUSDT',
    )
    expect(book?.symbol).toBe('BTCUSDT')
    expect(book?.bids).toEqual([
      { price: '64000.00', quantity: '0.5' },
      { price: '63000.00', quantity: '2' },
    ])
    expect(book?.asks).toEqual([{ price: '64100.00', quantity: '0.25' }])
  })

  it('rejects empty payloads', () => {
    expect(sanitizeOrderBook({ bids: [], asks: [] }, 'BTCUSDT')).toBeNull()
    expect(sanitizeOrderBook('nope', 'BTCUSDT')).toBeNull()
  })
})

describe('sanitizeAggTrade', () => {
  it('maps buyer-maker trades to sell side', () => {
    const trade = sanitizeAggTrade({ e: 'aggTrade', s: 'BTCUSDT', a: 42, p: '64000.10', q: '0.01', T: 1710000000000, m: true })
    expect(trade?.side).toBe('sell')
    expect(trade?.id).toBe('42')
  })

  it('rejects missing fields', () => {
    expect(sanitizeAggTrade({ s: 'BTCUSDT', p: '1' })).toBeNull()
  })
})

describe('sanitizeKline', () => {
  it('converts millisecond times to seconds', () => {
    const result = sanitizeKline({
      e: 'kline',
      k: { t: 1710000000000, o: '1', h: '2', l: '0.5', c: '1.5', v: '10', x: false },
    })
    expect(result?.candle.time).toBe(1710000000)
    expect(result?.candle.close).toBe(1.5)
    expect(result?.closed).toBe(false)
  })

  it('rejects invalid kline data', () => {
    expect(sanitizeKline({ k: { t: 1, o: '0', h: '2', l: '0.5', c: '1.5', v: '10' } })).toBeNull()
    expect(sanitizeKline({})).toBeNull()
  })
})
