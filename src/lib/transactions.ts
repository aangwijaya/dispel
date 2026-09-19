import { supabase } from './supabase'
import { friendlyDbError } from './errors'
import type { Transaction, TransactionKind } from '../types/trading'

const TRANSACTION_COLUMNS = 'id,kind,asset,amount,balance_after,network,address,created_at'
const ASSET_PATTERN = /^[A-Z0-9]{2,10}$/

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toDecimalString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') {
    const text = value.trim()
    if (/^\d+(\.\d+)?$/.test(text)) return text
  }
  return null
}

function toIsoString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : value
}

function isTransactionKind(value: unknown): value is TransactionKind {
  return value === 'deposit' || value === 'withdraw'
}

export function toTransaction(row: unknown): Transaction | null {
  const record = asRecord(row)
  if (!record) return null

  const id = typeof record.id === 'string' ? record.id : null
  const asset = typeof record.asset === 'string' && ASSET_PATTERN.test(record.asset) ? record.asset : null
  const amount = toDecimalString(record.amount)
  const balanceAfter = toDecimalString(record.balance_after)
  const createdAt = toIsoString(record.created_at)
  const network =
    typeof record.network === 'string' && record.network.trim() !== '' ? record.network.trim() : null
  const address =
    typeof record.address === 'string' && record.address.trim() !== '' ? record.address.trim() : null

  if (!id || !isTransactionKind(record.kind) || !asset || amount === null || balanceAfter === null || !createdAt) {
    return null
  }
  if ((network === null) !== (address === null)) return null

  return { id, kind: record.kind, asset, amount, balanceAfter, network, address, createdAt }
}

export async function adjustFunds(kind: TransactionKind, amount: string): Promise<Transaction> {
  const { data, error } = await supabase.rpc('adjust_paper_funds', {
    p_kind: kind,
    p_amount: amount,
  })
  if (error) throw new Error(friendlyDbError(error.message))
  const transaction = toTransaction(data)
  if (!transaction) throw new Error('Unexpected response from the paper engine.')
  return transaction
}

export interface CryptoTransferPayload {
  symbol: string
  asset: string
  kind: TransactionKind
  quantity: string
  network: string
  address: string
  referencePrice: string | null
}

export async function transferCrypto(payload: CryptoTransferPayload): Promise<Transaction> {
  const { data, error } = await supabase.rpc('transfer_paper_crypto', {
    p_symbol: payload.symbol,
    p_asset: payload.asset,
    p_kind: payload.kind,
    p_quantity: payload.quantity,
    p_network: payload.network,
    p_address: payload.address,
    p_reference_price: payload.referencePrice,
  })
  if (error) throw new Error(friendlyDbError(error.message))
  const transaction = toTransaction(data)
  if (!transaction) throw new Error('Unexpected response from the paper engine.')
  return transaction
}

export async function fetchTransactions(limit = 100): Promise<Transaction[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 500)
  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(safeLimit)
  if (error) throw new Error(friendlyDbError(error.message))
  if (!Array.isArray(data)) return []

  const transactions: Transaction[] = []
  for (const row of data) {
    const transaction = toTransaction(row)
    if (transaction) transactions.push(transaction)
  }
  return transactions
}
