export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit'
export type OrderStatus = 'open' | 'filled' | 'cancelled'

export interface Order {
  id: string
  symbol: string
  side: OrderSide
  type: OrderType
  limitPrice: string | null
  filledAvgPrice: string | null
  quantity: string
  filledQuantity: string
  fee: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  filledAt: string | null
}

export interface PaperAccount {
  cashBalance: string
}

export interface Position {
  symbol: string
  quantity: string
  avgEntryPrice: string
  realizedPnl: string
  updatedAt: string
}
