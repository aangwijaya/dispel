import { describe, expect, it } from 'vitest'
import { parseAuthUserId, parsePaperOrderRequest, parseRpcErrorMessage, parseTickerPrice } from './request.ts'

const ORDER_ID = '3f2a9c1e-8b4d-4e6f-9a1b-2c3d4e5f6a7b'

describe('parsePaperOrderRequest', () => {
  it('accepts a market order without a price', () => {
    expect(
      parsePaperOrderRequest({ action: 'place', symbol: 'BTCUSDT', side: 'buy', type: 'market', price: null, quantity: '0.01' }),
    ).toEqual({ action: 'place', symbol: 'BTCUSDT', side: 'buy', type: 'market', price: null, quantity: '0.01' })
  })

  it('accepts a limit order with a positive price', () => {
    expect(
      parsePaperOrderRequest({ action: 'place', symbol: 'ETHUSDT', side: 'sell', type: 'limit', price: '2500.5', quantity: '1' }),
    ).toEqual({ action: 'place', symbol: 'ETHUSDT', side: 'sell', type: 'limit', price: '2500.5', quantity: '1' })
  })

  it('accepts a fill by order id only', () => {
    expect(parsePaperOrderRequest({ action: 'fill', orderId: ORDER_ID })).toEqual({ action: 'fill', orderId: ORDER_ID })
  })

  it('drops a client-supplied fill or reference price', () => {
    expect(parsePaperOrderRequest({ action: 'fill', orderId: ORDER_ID, fillPrice: '0.01' })).toEqual({
      action: 'fill',
      orderId: ORDER_ID,
    })
    const placed = parsePaperOrderRequest({
      action: 'place',
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'market',
      quantity: '1',
      referencePrice: '0.01',
    })
    expect(placed).not.toHaveProperty('referencePrice')
  })

  it('rejects a market order that carries a price', () => {
    expect(
      parsePaperOrderRequest({ action: 'place', symbol: 'BTCUSDT', side: 'buy', type: 'market', price: '1', quantity: '1' }),
    ).toBeNull()
  })

  it('rejects unknown symbols, bad numbers and malformed ids', () => {
    const base = { action: 'place', symbol: 'BTCUSDT', side: 'buy', type: 'limit', price: '100', quantity: '1' }
    expect(parsePaperOrderRequest({ ...base, symbol: 'FAKEUSDT' })).toBeNull()
    expect(parsePaperOrderRequest({ ...base, side: 'long' })).toBeNull()
    expect(parsePaperOrderRequest({ ...base, price: '0' })).toBeNull()
    expect(parsePaperOrderRequest({ ...base, price: '-1' })).toBeNull()
    expect(parsePaperOrderRequest({ ...base, quantity: 1 })).toBeNull()
    expect(parsePaperOrderRequest({ ...base, quantity: '1e5' })).toBeNull()
    expect(parsePaperOrderRequest({ action: 'fill', orderId: 'not-a-uuid' })).toBeNull()
    expect(parsePaperOrderRequest({ action: 'cancel', orderId: ORDER_ID })).toBeNull()
    expect(parsePaperOrderRequest(null)).toBeNull()
    expect(parsePaperOrderRequest([base])).toBeNull()
  })
})

describe('parsePaperOrderRequest transfer', () => {
  const evm = '0x52908400098527886E0F7030069857D2E4169EE7'
  const base = { action: 'transfer', symbol: 'ETHUSDT', asset: 'ETH', kind: 'deposit', quantity: '0.5', network: 'arbitrum', address: evm }

  it('accepts a deposit with a valid address for the network', () => {
    expect(parsePaperOrderRequest(base)).toEqual(base)
    expect(parsePaperOrderRequest({ ...base, kind: 'withdraw' })).toEqual({ ...base, kind: 'withdraw' })
  })

  it('drops a client-supplied reference price', () => {
    expect(parsePaperOrderRequest({ ...base, referencePrice: '0.01' })).toEqual(base)
  })

  it('rejects mismatched assets, unknown networks and addresses of the wrong family', () => {
    expect(parsePaperOrderRequest({ ...base, symbol: 'BTCUSDT' })).toBeNull()
    expect(parsePaperOrderRequest({ ...base, asset: 'DOGE', symbol: 'DOGEUSDT' })).toBeNull()
    expect(parsePaperOrderRequest({ ...base, network: 'solana' })).toBeNull()
    expect(parsePaperOrderRequest({ ...base, address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' })).toBeNull()
    expect(parsePaperOrderRequest({ ...base, address: ` ${evm}` })).toBeNull()
    expect(parsePaperOrderRequest({ ...base, kind: 'mint' })).toBeNull()
    expect(parsePaperOrderRequest({ ...base, quantity: '0' })).toBeNull()
  })

  it('rejects assets that are not transferable', () => {
    expect(
      parsePaperOrderRequest({ ...base, asset: 'OP', symbol: 'OPUSDT', network: 'optimism' }),
    ).toBeNull()
  })
})

describe('parseTickerPrice', () => {
  it('returns the price for the requested symbol only', () => {
    expect(parseTickerPrice({ symbol: 'BTCUSDT', price: '67012.34000000' }, 'BTCUSDT')).toBe('67012.34000000')
    expect(parseTickerPrice({ symbol: 'ETHUSDT', price: '2500.00' }, 'BTCUSDT')).toBeNull()
  })

  it('rejects zero, non-string and HTML payloads', () => {
    expect(parseTickerPrice({ symbol: 'BTCUSDT', price: '0.00000000' }, 'BTCUSDT')).toBeNull()
    expect(parseTickerPrice({ symbol: 'BTCUSDT', price: 67000 }, 'BTCUSDT')).toBeNull()
    expect(parseTickerPrice('<html>blocked</html>', 'BTCUSDT')).toBeNull()
  })
})

describe('parseAuthUserId', () => {
  it('reads a uuid id and rejects anything else', () => {
    expect(parseAuthUserId({ id: ORDER_ID, email: 'a@b.c' })).toBe(ORDER_ID)
    expect(parseAuthUserId({ id: 'admin' })).toBeNull()
    expect(parseAuthUserId(null)).toBeNull()
  })
})

describe('parseRpcErrorMessage', () => {
  it('passes Postgres exception codes through and hides everything else', () => {
    expect(parseRpcErrorMessage({ code: 'P0001', message: 'insufficient_balance' })).toBe('insufficient_balance')
    expect(parseRpcErrorMessage({ message: 'relation "orders" does not exist' })).toBe('rpc_failed')
    expect(parseRpcErrorMessage(null)).toBe('rpc_failed')
  })
})
