import { dec } from './decimal'
import type { Market } from '../types/market'
import type { OrderSide, OrderType } from '../types/trading'

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SYMBOL_PATTERN = /^[A-Z0-9]{5,20}$/
const MAX_DECIMAL_MAGNITUDE = '1000000000000'

export function parseEmail(raw: string): Parsed<string> {
  const value = raw.trim().toLowerCase()
  if (value === '') return { ok: false, error: 'Email is required.' }
  if (!EMAIL_PATTERN.test(value)) return { ok: false, error: 'Enter a valid email address.' }
  return { ok: true, value }
}

export function parsePassword(raw: string): Parsed<string> {
  if (raw === '') return { ok: false, error: 'Password is required.' }
  if (raw.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }
  if (raw.length > 72) return { ok: false, error: 'Password must be at most 72 characters.' }
  return { ok: true, value: raw }
}

export function parseOrderSide(raw: string): Parsed<OrderSide> {
  if (raw === 'buy' || raw === 'sell') return { ok: true, value: raw }
  return { ok: false, error: 'Invalid order side.' }
}

export function parseOrderType(raw: string): Parsed<OrderType> {
  if (raw === 'market' || raw === 'limit') return { ok: true, value: raw }
  return { ok: false, error: 'Invalid order type.' }
}

function parseDecimal(raw: string, precision: number, label: string): Parsed<string> {
  const value = raw.trim()
  if (value === '') return { ok: false, error: `${label} is required.` }
  if (!DECIMAL_PATTERN.test(value)) {
    return { ok: false, error: `${label} must be a plain positive number.` }
  }
  const decimals = value.includes('.') ? (value.split('.')[1]?.length ?? 0) : 0
  if (decimals > precision) {
    return { ok: false, error: `${label} supports at most ${precision} decimal places.` }
  }
  const numeric = dec(value)
  if (!numeric.gt(0)) return { ok: false, error: `${label} must be greater than zero.` }
  if (numeric.gt(MAX_DECIMAL_MAGNITUDE)) return { ok: false, error: `${label} is unreasonably large.` }
  return { ok: true, value }
}

export function parsePrice(raw: string, market: Market): Parsed<string> {
  return parseDecimal(raw, market.pricePrecision, 'Price')
}

export function parseQuantity(raw: string, market: Market): Parsed<string> {
  return parseDecimal(raw, market.quantityPrecision, 'Quantity')
}

export function parseSymbol(raw: string, markets: Market[]): Parsed<string> {
  const value = raw.trim().toUpperCase()
  if (!SYMBOL_PATTERN.test(value)) return { ok: false, error: 'Invalid market symbol.' }
  if (!markets.some((market) => market.symbol === value)) {
    return { ok: false, error: 'Unsupported market symbol.' }
  }
  return { ok: true, value }
}

export function parseFundsAmount(raw: string): Parsed<string> {
  const value = raw.trim()
  if (value === '') return { ok: false, error: 'Amount is required.' }
  if (!DECIMAL_PATTERN.test(value)) {
    return { ok: false, error: 'Amount must be a plain positive number.' }
  }
  const decimals = value.includes('.') ? (value.split('.')[1]?.length ?? 0) : 0
  if (decimals > 2) return { ok: false, error: 'Amount supports at most 2 decimal places.' }
  const numeric = dec(value)
  if (numeric.lt(1)) return { ok: false, error: 'Minimum amount is 1 USDT.' }
  if (numeric.gt(1000000)) return { ok: false, error: 'Maximum amount is 1,000,000 USDT.' }
  return { ok: true, value: numeric.toFixed(2) }
}

export function checkMinNotional(
  referencePrice: string,
  quantity: string,
  market: Market,
): Parsed<string> {
  const notional = dec(referencePrice).mul(dec(quantity))
  if (notional.lt(market.minNotional)) {
    return {
      ok: false,
      error: `Order value must be at least ${market.minNotional} ${market.quoteAsset}.`,
    }
  }
  return { ok: true, value: notional.toFixed(8) }
}
