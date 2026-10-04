import { MARKETS } from '../../../../src/lib/markets.ts'

export type PaperOrderRequest =
  | {
      action: 'place'
      symbol: string
      side: 'buy' | 'sell'
      type: 'market' | 'limit'
      price: string | null
      quantity: string
    }
  | { action: 'fill'; orderId: string }

const DECIMAL = /^\d{1,16}(\.\d{1,18})?$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SYMBOLS = new Set(MARKETS.map((market) => market.symbol))

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function positiveDecimal(value: unknown): string | null {
  if (typeof value !== 'string' || !DECIMAL.test(value)) return null
  return /[1-9]/.test(value) ? value : null
}

/** Accepts only the exact fields of a place or fill request; anything else is rejected. */
export function parsePaperOrderRequest(body: unknown): PaperOrderRequest | null {
  const record = asRecord(body)
  if (!record) return null

  if (record.action === 'fill') {
    const orderId = record.orderId
    return typeof orderId === 'string' && UUID.test(orderId) ? { action: 'fill', orderId } : null
  }

  if (record.action !== 'place') return null
  const { symbol, side, type } = record
  if (typeof symbol !== 'string' || !SYMBOLS.has(symbol)) return null
  if (side !== 'buy' && side !== 'sell') return null
  if (type !== 'market' && type !== 'limit') return null
  const quantity = positiveDecimal(record.quantity)
  if (quantity === null) return null

  if (type === 'market') {
    if (record.price !== null && record.price !== undefined) return null
    return { action: 'place', symbol, side, type, price: null, quantity }
  }
  const price = positiveDecimal(record.price)
  if (price === null) return null
  return { action: 'place', symbol, side, type, price, quantity }
}

/** Binance `/api/v3/ticker/price` payload → price string for the expected symbol. */
export function parseTickerPrice(payload: unknown, symbol: string): string | null {
  const record = asRecord(payload)
  if (!record || record.symbol !== symbol) return null
  return positiveDecimal(record.price)
}

/** Reads the user id from a GoTrue `/auth/v1/user` response. */
export function parseAuthUserId(payload: unknown): string | null {
  const id = asRecord(payload)?.id
  return typeof id === 'string' && UUID.test(id) ? id : null
}

/** Pulls the Postgres exception text (`insufficient_balance`, …) out of a PostgREST error body. */
export function parseRpcErrorMessage(payload: unknown): string {
  const message = asRecord(payload)?.message
  return typeof message === 'string' && /^[a-z_]{3,40}$/.test(message) ? message : 'rpc_failed'
}
