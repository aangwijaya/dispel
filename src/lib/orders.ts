import { supabase } from './supabase'
import { friendlyDbError } from './errors'
import type { Order, OrderSide, OrderStatus, OrderType, PaperAccount, Position } from '../types/trading'

const ORDER_COLUMNS =
  'id,symbol,side,type,limit_price,filled_avg_price,quantity,filled_quantity,fee,status,created_at,updated_at,filled_at'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toDecimalString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') {
    const text = value.trim()
    if (/^-?\d+(\.\d+)?$/.test(text)) return text
  }
  return null
}

function toIsoString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : value
}

function isOrderSide(value: unknown): value is OrderSide {
  return value === 'buy' || value === 'sell'
}

function isOrderType(value: unknown): value is OrderType {
  return value === 'market' || value === 'limit'
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return value === 'open' || value === 'filled' || value === 'cancelled'
}

export function toOrder(row: unknown): Order | null {
  const record = asRecord(row)
  if (!record) return null

  const id = typeof record.id === 'string' ? record.id : null
  const symbol = typeof record.symbol === 'string' ? record.symbol : null
  const quantity = toDecimalString(record.quantity)
  const filledQuantity = toDecimalString(record.filled_quantity)
  const fee = toDecimalString(record.fee)
  const createdAt = toIsoString(record.created_at)
  const updatedAt = toIsoString(record.updated_at)

  if (!id || !symbol || !isOrderSide(record.side) || !isOrderType(record.type) || !isOrderStatus(record.status)) {
    return null
  }
  if (quantity === null || filledQuantity === null || fee === null || !createdAt || !updatedAt) {
    return null
  }

  return {
    id,
    symbol,
    side: record.side,
    type: record.type,
    limitPrice: toDecimalString(record.limit_price),
    filledAvgPrice: toDecimalString(record.filled_avg_price),
    quantity,
    filledQuantity,
    fee,
    status: record.status,
    createdAt,
    updatedAt,
    filledAt: toIsoString(record.filled_at),
  }
}

function toOrders(data: unknown): Order[] {
  if (!Array.isArray(data)) return []
  const orders: Order[] = []
  for (const row of data) {
    const order = toOrder(row)
    if (order) orders.push(order)
  }
  return orders
}

export function toPosition(row: unknown): Position | null {
  const record = asRecord(row)
  if (!record) return null

  const symbol = typeof record.symbol === 'string' ? record.symbol : null
  const quantity = toDecimalString(record.quantity)
  const avgEntryPrice = toDecimalString(record.avg_entry_price)
  const realizedPnl = toDecimalString(record.realized_pnl)
  const updatedAt = toIsoString(record.updated_at)

  if (!symbol || quantity === null || avgEntryPrice === null || realizedPnl === null || !updatedAt) {
    return null
  }

  return { symbol, quantity, avgEntryPrice, realizedPnl, updatedAt }
}

export function toAccount(row: unknown): PaperAccount | null {
  const record = asRecord(row)
  if (!record) return null
  const cashBalance = toDecimalString(record.cash_balance)
  if (cashBalance === null) return null
  return { cashBalance }
}

async function callRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(friendlyDbError(error.message))
  return data
}

export interface PlaceOrderPayload {
  symbol: string
  side: OrderSide
  type: OrderType
  price: string | null
  quantity: string
  referencePrice: string
}

export async function placeOrder(payload: PlaceOrderPayload): Promise<Order> {
  const data = await callRpc('place_order', {
    p_symbol: payload.symbol,
    p_side: payload.side,
    p_type: payload.type,
    p_price: payload.price,
    p_quantity: payload.quantity,
    p_reference_price: payload.referencePrice,
  })
  const order = toOrder(data)
  if (!order) throw new Error('Unexpected response from the trading engine.')
  return order
}

export async function fillOrder(orderId: string, fillPrice: string): Promise<Order> {
  const data = await callRpc('fill_order', { p_order_id: orderId, p_fill_price: fillPrice })
  const order = toOrder(data)
  if (!order) throw new Error('Unexpected response from the trading engine.')
  return order
}

export async function cancelOrder(orderId: string): Promise<Order> {
  const data = await callRpc('cancel_order', { p_order_id: orderId })
  const order = toOrder(data)
  if (!order) throw new Error('Unexpected response from the trading engine.')
  return order
}

export async function fetchOrders(limit = 100): Promise<Order[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 500)
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(safeLimit)
  if (error) throw new Error(friendlyDbError(error.message))
  return toOrders(data)
}

export async function fetchAccount(): Promise<PaperAccount> {
  const { data, error } = await supabase.from('paper_accounts').select('cash_balance').maybeSingle()
  if (error) throw new Error(friendlyDbError(error.message))
  const account = toAccount(data)
  if (!account) throw new Error('Paper account not found.')
  return account
}

export async function fetchPositions(): Promise<Position[]> {
  const { data, error } = await supabase
    .from('paper_positions')
    .select('symbol,quantity,avg_entry_price,realized_pnl,updated_at')
    .gt('quantity', 0)
    .order('symbol')
  if (error) throw new Error(friendlyDbError(error.message))
  if (!Array.isArray(data)) return []
  const positions: Position[] = []
  for (const row of data) {
    const position = toPosition(row)
    if (position) positions.push(position)
  }
  return positions
}
