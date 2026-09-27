import { sanitizeKlineRow, sanitizeTicker } from '../../../../src/lib/market/binance.ts'
import type { Candle, Ticker } from './types.ts'

/** Parse the `/api/v3/ticker/24hr` payload into sanitized tickers. */
export function parseTickerPayload(raw: unknown): Ticker[] {
  if (!Array.isArray(raw)) throw new Error('invalid_tickers_payload')
  const tickers: Ticker[] = []
  for (const item of raw) {
    const ticker = sanitizeTicker(item)
    if (ticker) tickers.push(ticker)
  }
  return tickers
}

/** Parse the `/api/v3/klines` payload into sanitized candles. */
export function parseKlinePayload(raw: unknown): Candle[] {
  if (!Array.isArray(raw)) throw new Error('invalid_klines_payload')
  const candles: Candle[] = []
  for (const item of raw) {
    const candle = sanitizeKlineRow(item)
    if (candle) candles.push(candle)
  }
  return candles
}
