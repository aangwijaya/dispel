import { describe, expect, it } from 'vitest'
import { toTransaction } from './transactions'

describe('toTransaction', () => {
  it('maps a cash ledger row', () => {
    const transaction = toTransaction({
      id: '6f1b0f6e-0000-0000-0000-000000000000',
      kind: 'deposit',
      asset: 'USDT',
      amount: '500.00000000',
      balance_after: '100500.00000000',
      network: null,
      address: null,
      created_at: '2026-09-20T10:00:00.000Z',
    })
    expect(transaction).toEqual({
      id: '6f1b0f6e-0000-0000-0000-000000000000',
      kind: 'deposit',
      asset: 'USDT',
      amount: '500.00000000',
      balanceAfter: '100500.00000000',
      network: null,
      address: null,
      createdAt: '2026-09-20T10:00:00.000Z',
    })
  })

  it('maps a crypto transfer row', () => {
    const transaction = toTransaction({
      id: 't2',
      kind: 'withdraw',
      asset: 'BTC',
      amount: '0.50000000',
      balance_after: '1.50000000',
      network: 'bitcoin',
      address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      created_at: '2026-09-20T10:00:00.000Z',
    })
    expect(transaction?.asset).toBe('BTC')
    expect(transaction?.network).toBe('bitcoin')
    expect(transaction?.address).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')
  })

  it('accepts numeric values returned by PostgREST', () => {
    const transaction = toTransaction({
      id: 't1',
      kind: 'withdraw',
      asset: 'USDT',
      amount: 250.5,
      balance_after: 100249.5,
      network: null,
      address: null,
      created_at: '2026-09-20T10:00:00.000Z',
    })
    expect(transaction?.amount).toBe('250.5')
    expect(transaction?.balanceAfter).toBe('100249.5')
  })

  it('rejects unknown kinds, bad assets and missing fields', () => {
    const base = {
      id: 't1',
      kind: 'deposit',
      asset: 'USDT',
      amount: '1',
      balance_after: '1',
      network: null,
      address: null,
      created_at: '2026-09-20T10:00:00.000Z',
    }
    expect(toTransaction({ ...base, kind: 'transfer' })).toBeNull()
    expect(toTransaction({ ...base, asset: 'usdt' })).toBeNull()
    expect(toTransaction({ ...base, amount: 'x' })).toBeNull()
    expect(toTransaction({ ...base, created_at: 'bad-date' })).toBeNull()
    expect(toTransaction(null)).toBeNull()
    expect(toTransaction({ id: 't1' })).toBeNull()
  })

  it('rejects partially filled transfer details', () => {
    const base = {
      id: 't1',
      kind: 'deposit',
      asset: 'BTC',
      amount: '1',
      balance_after: '1',
      created_at: '2026-09-20T10:00:00.000Z',
    }
    expect(toTransaction({ ...base, network: 'bitcoin', address: null })).toBeNull()
    expect(toTransaction({ ...base, network: null, address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' })).toBeNull()
  })
})
