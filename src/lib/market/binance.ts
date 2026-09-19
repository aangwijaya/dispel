import { TIMEFRAMES, type Candle, type DepthLevel, type MarketTrade, type OrderBook, type Ticker, type Timeframe } from '../../types/market'

const REST_HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision']
const SYMBOL_PATTERN = /^[A-Z0-9]{5,20}$/
const DEPTH_LEVELS = 20

let restHostIndex = 0

async function restFetch(path: string): Promise<unknown> {
  let lastStatus = 0

  for (let attempt = 0; attempt < REST_HOSTS.length; attempt += 1) {
    const index = (restHostIndex + attempt) % REST_HOSTS.length
    const host = REST_HOSTS[index]
    if (!host) continue

    try {
      const response = await fetch(`${host}${path}`)
      if (!response.ok) {
        lastStatus = response.status
        continue
      }

      const text = await response.text()
      try {
        const payload: unknown = JSON.parse(text)
        restHostIndex = index
        return payload
      } catch {
        lastStatus = 0
      }
    } catch {
      lastStatus = 0
    }
  }

  throw new Error(lastStatus > 0 ? `Market data request failed (${lastStatus})` : 'Market data host unreachable')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toDecimalString(value: unknown, allowNegative = false): string | null {
  const pattern = allowNegative ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const text = String(value)
    return pattern.test(text) ? text : null
  }
  if (typeof value === 'string') {
    const text = value.trim()
    return pattern.test(text) ? text : null
  }
  return null
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const numeric = Number(value.trim())
    return Number.isFinite(numeric) ? numeric : null
  }
  return null
}

export function sanitizeTicker(raw: unknown): Ticker | null {
  const record = asRecord(raw)
  if (!record) return null

  const symbol =
    typeof record.s === 'string' ? record.s : typeof record.symbol === 'string' ? record.symbol : null
  const lastPrice = toDecimalString(record.c ?? record.lastPrice)
  const changePercent = toDecimalString(record.P ?? record.priceChangePercent, true)
  const highPrice = toDecimalString(record.h ?? record.highPrice)
  const lowPrice = toDecimalString(record.l ?? record.lowPrice)
  const volume = toDecimalString(record.v ?? record.volume)
  const quoteVolume = toDecimalString(record.q ?? record.quoteVolume)

  if (!symbol || !SYMBOL_PATTERN.test(symbol)) return null
  if (
    lastPrice === null ||
    changePercent === null ||
    highPrice === null ||
    lowPrice === null ||
    volume === null ||
    quoteVolume === null
  ) {
    return null
  }
  if (!(Number(lastPrice) > 0)) return null

  return { symbol, lastPrice, changePercent, highPrice, lowPrice, volume, quoteVolume }
}

function sanitizeLevels(raw: unknown): DepthLevel[] {
  if (!Array.isArray(raw)) return []
  const levels: DepthLevel[] = []
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 2) continue
    const price = toDecimalString(entry[0])
    const quantity = toDecimalString(entry[1])
    if (price === null || quantity === null) continue
    if (!(Number(price) > 0)) continue
    levels.push({ price, quantity })
    if (levels.length >= DEPTH_LEVELS) break
  }
  return levels
}

export function sanitizeOrderBook(raw: unknown, symbol: string): OrderBook | null {
  const record = asRecord(raw)
  if (!record) return null
  const bids = sanitizeLevels(record.bids)
  const asks = sanitizeLevels(record.asks)
  if (bids.length === 0 && asks.length === 0) return null
  return { symbol, bids, asks }
}

export function sanitizeAggTrade(raw: unknown): MarketTrade | null {
  const record = asRecord(raw)
  if (!record) return null

  const symbol = typeof record.s === 'string' ? record.s : null
  const price = toDecimalString(record.p)
  const quantity = toDecimalString(record.q)
  const time = toFiniteNumber(record.T)
  const id =
    typeof record.a === 'number' ? String(record.a) : typeof record.a === 'string' ? record.a : null
  const buyerIsMaker = record.m === true

  if (!symbol || !SYMBOL_PATTERN.test(symbol)) return null
  if (price === null || quantity === null || time === null || id === null) return null
  if (!(Number(price) > 0)) return null

  return {
    id,
    symbol,
    price,
    quantity,
    side: buyerIsMaker ? 'sell' : 'buy',
    time,
  }
}

export function sanitizeKline(raw: unknown): { candle: Candle; closed: boolean } | null {
  const message = asRecord(raw)
  if (!message) return null
  const payload = asRecord(message.k)
  if (!payload) return null

  const time = toFiniteNumber(payload.t)
  const open = toFiniteNumber(payload.o)
  const high = toFiniteNumber(payload.h)
  const low = toFiniteNumber(payload.l)
  const close = toFiniteNumber(payload.c)
  const volume = toFiniteNumber(payload.v)
  const closed = payload.x === true

  if (time === null || open === null || high === null || low === null || close === null || volume === null) {
    return null
  }
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) return null

  return {
    candle: { time: Math.floor(time / 1000), open, high, low, close, volume },
    closed,
  }
}

function sanitizeKlineRow(raw: unknown): Candle | null {
  if (!Array.isArray(raw) || raw.length < 6) return null
  const time = toFiniteNumber(raw[0])
  const open = toFiniteNumber(raw[1])
  const high = toFiniteNumber(raw[2])
  const low = toFiniteNumber(raw[3])
  const close = toFiniteNumber(raw[4])
  const volume = toFiniteNumber(raw[5])
  if (time === null || open === null || high === null || low === null || close === null || volume === null) {
    return null
  }
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) return null
  return { time: Math.floor(time / 1000), open, high, low, close, volume }
}

export async function fetchTickers(symbols: string[]): Promise<Ticker[]> {
  if (symbols.length === 0) return []
  const query = encodeURIComponent(JSON.stringify(symbols))
  const payload = await restFetch(`/api/v3/ticker/24hr?symbols=${query}`)
  if (!Array.isArray(payload)) throw new Error('Unexpected market data response')

  const tickers: Ticker[] = []
  for (const item of payload) {
    const ticker = sanitizeTicker(item)
    if (ticker) tickers.push(ticker)
  }
  return tickers
}

export async function fetchKlines(symbol: string, interval: Timeframe, limit = 500): Promise<Candle[]> {
  if (!SYMBOL_PATTERN.test(symbol)) throw new Error('Invalid market symbol')
  if (!TIMEFRAMES.includes(interval)) throw new Error('Invalid timeframe')
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 1000)

  const payload = await restFetch(
    `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${safeLimit}`,
  )
  if (!Array.isArray(payload)) throw new Error('Unexpected chart data response')

  const candles: Candle[] = []
  for (const item of payload) {
    const candle = sanitizeKlineRow(item)
    if (candle) candles.push(candle)
  }
  return candles
}
