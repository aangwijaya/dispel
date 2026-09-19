import type { Parsed } from './validation'

export type AddressFamily = 'evm' | 'solana' | 'bitcoin'

export interface CryptoNetwork {
  id: string
  label: string
  family: AddressFamily
}

export interface TransferAsset {
  symbol: string
  marketSymbol: string
  networks: CryptoNetwork[]
}

const ETHEREUM: CryptoNetwork = { id: 'ethereum', label: 'Ethereum (ERC20)', family: 'evm' }
const BNB_CHAIN: CryptoNetwork = { id: 'bsc', label: 'BNB Smart Chain (BEP20)', family: 'evm' }
const ARBITRUM: CryptoNetwork = { id: 'arbitrum', label: 'Arbitrum One', family: 'evm' }
const BASE: CryptoNetwork = { id: 'base', label: 'Base', family: 'evm' }
const OPTIMISM: CryptoNetwork = { id: 'optimism', label: 'Optimism', family: 'evm' }
const AVALANCHE: CryptoNetwork = { id: 'avalanche', label: 'Avalanche C-Chain', family: 'evm' }
const BITCOIN: CryptoNetwork = { id: 'bitcoin', label: 'Bitcoin', family: 'bitcoin' }
const SOLANA: CryptoNetwork = { id: 'solana', label: 'Solana', family: 'solana' }

export const TRANSFER_ASSETS: TransferAsset[] = [
  { symbol: 'BTC', marketSymbol: 'BTCUSDT', networks: [BITCOIN] },
  { symbol: 'ETH', marketSymbol: 'ETHUSDT', networks: [ETHEREUM, ARBITRUM, BASE, OPTIMISM] },
  { symbol: 'SOL', marketSymbol: 'SOLUSDT', networks: [SOLANA] },
  { symbol: 'BNB', marketSymbol: 'BNBUSDT', networks: [BNB_CHAIN] },
  { symbol: 'AVAX', marketSymbol: 'AVAXUSDT', networks: [AVALANCHE] },
  {
    symbol: 'LINK',
    marketSymbol: 'LINKUSDT',
    networks: [ETHEREUM, BNB_CHAIN, ARBITRUM, BASE],
  },
  { symbol: 'UNI', marketSymbol: 'UNIUSDT', networks: [ETHEREUM, ARBITRUM, BASE] },
  { symbol: 'ARB', marketSymbol: 'ARBUSDT', networks: [ARBITRUM, ETHEREUM] },
  { symbol: 'OP', marketSymbol: 'OPUSDT', networks: [OPTIMISM, ETHEREUM] },
]

const EVM_PATTERN = /^0x[a-fA-F0-9]{40}$/
const SOLANA_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const BITCOIN_BECH32_PATTERN = /^bc1[a-z0-9]{25,62}$/
const BITCOIN_LEGACY_PATTERN = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/

const ADDRESS_PLACEHOLDERS: Record<AddressFamily, string> = {
  evm: '0x…',
  solana: 'Base58 address',
  bitcoin: 'bc1… / 1… / 3…',
}

const ADDRESS_ERRORS: Record<AddressFamily, string> = {
  evm: 'Enter a valid EVM address (0x followed by 40 hex characters).',
  solana: 'Enter a valid Solana address (base58, 32-44 characters).',
  bitcoin: 'Enter a valid Bitcoin address (bc1 or legacy).',
}

export function getTransferAsset(symbol: string): TransferAsset | undefined {
  return TRANSFER_ASSETS.find((asset) => asset.symbol === symbol)
}

export function addressPlaceholder(family: AddressFamily): string {
  return ADDRESS_PLACEHOLDERS[family]
}

export function parseAddress(raw: string, family: AddressFamily): Parsed<string> {
  const value = raw.trim()
  if (value === '') return { ok: false, error: 'Address is required.' }

  if (family === 'evm') {
    return EVM_PATTERN.test(value) ? { ok: true, value } : { ok: false, error: ADDRESS_ERRORS.evm }
  }
  if (family === 'solana') {
    return SOLANA_PATTERN.test(value)
      ? { ok: true, value }
      : { ok: false, error: ADDRESS_ERRORS.solana }
  }

  const bitcoinValid = BITCOIN_BECH32_PATTERN.test(value.toLowerCase()) || BITCOIN_LEGACY_PATTERN.test(value)
  return bitcoinValid ? { ok: true, value } : { ok: false, error: ADDRESS_ERRORS.bitcoin }
}
