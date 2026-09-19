import { describe, expect, it } from 'vitest'
import { checkMinNotional, parseEmail, parseOrderSide, parsePassword, parsePrice, parseQuantity, parseSymbol } from './validation'
import { MARKETS } from './markets'

const BTC = MARKETS[0]
const market = BTC
if (!market) throw new Error('test fixture missing')

describe('parseEmail', () => {
  it('normalizes case and whitespace', () => {
    const result = parseEmail('  User@Example.COM ')
    expect(result).toEqual({ ok: true, value: 'user@example.com' })
  })

  it('rejects invalid emails', () => {
    expect(parseEmail('').ok).toBe(false)
    expect(parseEmail('not-an-email').ok).toBe(false)
  })
})

describe('parsePassword', () => {
  it('enforces length bounds', () => {
    expect(parsePassword('short').ok).toBe(false)
    expect(parsePassword('longenough1').ok).toBe(true)
    expect(parsePassword('x'.repeat(73)).ok).toBe(false)
  })
})

describe('parseOrderSide', () => {
  it('accepts only buy or sell', () => {
    expect(parseOrderSide('buy')).toEqual({ ok: true, value: 'buy' })
    expect(parseOrderSide('long').ok).toBe(false)
  })
})

describe('parsePrice and parseQuantity', () => {
  it('rejects malformed decimal input', () => {
    expect(parsePrice('', market).ok).toBe(false)
    expect(parsePrice('1e5', market).ok).toBe(false)
    expect(parsePrice('1,000', market).ok).toBe(false)
    expect(parsePrice('-1', market).ok).toBe(false)
    expect(parsePrice('0', market).ok).toBe(false)
  })

  it('enforces market precision', () => {
    expect(parsePrice('64000.123', market).ok).toBe(false)
    expect(parsePrice('64000.12', market)).toEqual({ ok: true, value: '64000.12' })
    expect(parseQuantity('0.1234567', market).ok).toBe(false)
    expect(parseQuantity('0.123456', market).ok).toBe(true)
  })

  it('trims whitespace', () => {
    expect(parseQuantity(' 1.5 ', market)).toEqual({ ok: true, value: '1.5' })
  })
})

describe('parseSymbol', () => {
  it('only accepts known markets', () => {
    expect(parseSymbol('btcusdt', MARKETS)).toEqual({ ok: true, value: 'BTCUSDT' })
    expect(parseSymbol('FAKECOIN', MARKETS).ok).toBe(false)
    expect(parseSymbol('', MARKETS).ok).toBe(false)
  })
})

describe('checkMinNotional', () => {
  it('enforces the market minimum', () => {
    expect(checkMinNotional('64000', '0.00005', market).ok).toBe(false)
    expect(checkMinNotional('64000', '0.001', market).ok).toBe(true)
  })
})
