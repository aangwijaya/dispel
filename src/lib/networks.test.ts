import { describe, expect, it } from 'vitest'
import { TRANSFER_ASSETS, getTransferAsset, parseAddress } from './networks'
import { MARKETS } from './markets'

const EVM_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'
const SOLANA_ADDRESS = 'So11111111111111111111111111111111111111112'
const BITCOIN_BECH32 = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
const BITCOIN_LEGACY = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'

describe('parseAddress', () => {
  it('accepts EVM addresses', () => {
    expect(parseAddress(EVM_ADDRESS, 'evm')).toEqual({ ok: true, value: EVM_ADDRESS })
    expect(parseAddress(` ${EVM_ADDRESS} `, 'evm')).toEqual({ ok: true, value: EVM_ADDRESS })
  })

  it('rejects malformed EVM addresses', () => {
    expect(parseAddress('0x1234', 'evm').ok).toBe(false)
    expect(parseAddress('12abcdef1234567890abcdef1234567890A9F2', 'evm').ok).toBe(false)
    expect(parseAddress('0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ', 'evm').ok).toBe(false)
  })

  it('accepts base58 Solana addresses', () => {
    expect(parseAddress(SOLANA_ADDRESS, 'solana')).toEqual({ ok: true, value: SOLANA_ADDRESS })
  })

  it('rejects Solana addresses with invalid characters', () => {
    expect(parseAddress('0'.repeat(44), 'solana').ok).toBe(false)
    expect(parseAddress('short', 'solana').ok).toBe(false)
  })

  it('accepts Bitcoin bech32 and legacy addresses', () => {
    expect(parseAddress(BITCOIN_BECH32, 'bitcoin')).toEqual({ ok: true, value: BITCOIN_BECH32 })
    expect(parseAddress(BITCOIN_LEGACY, 'bitcoin')).toEqual({ ok: true, value: BITCOIN_LEGACY })
  })

  it('rejects unknown Bitcoin formats', () => {
    expect(parseAddress('bc2qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'bitcoin').ok).toBe(false)
    expect(parseAddress(EVM_ADDRESS, 'bitcoin').ok).toBe(false)
  })

  it('rejects empty input', () => {
    expect(parseAddress('   ', 'evm').ok).toBe(false)
  })
})

describe('transfer asset config', () => {
  it('maps every transfer asset to a curated market', () => {
    for (const asset of TRANSFER_ASSETS) {
      const market = MARKETS.find((item) => item.symbol === asset.marketSymbol)
      expect(market, `missing market for ${asset.symbol}`).toBeDefined()
      expect(market?.baseAsset).toBe(asset.symbol)
    }
  })

  it('gives every asset at least one unique network', () => {
    for (const asset of TRANSFER_ASSETS) {
      expect(asset.networks.length).toBeGreaterThan(0)
      const ids = new Set(asset.networks.map((network) => network.id))
      expect(ids.size).toBe(asset.networks.length)
    }
  })

  it('covers the supported address families', () => {
    const families = new Set(TRANSFER_ASSETS.flatMap((asset) => asset.networks.map((n) => n.family)))
    expect(families).toEqual(new Set(['evm', 'solana', 'bitcoin']))
  })

  it('looks up assets by symbol', () => {
    expect(getTransferAsset('BTC')?.marketSymbol).toBe('BTCUSDT')
    expect(getTransferAsset('NOPE')).toBeUndefined()
  })
})
