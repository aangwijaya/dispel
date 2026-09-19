export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d']

export interface Market {
  symbol: string
  baseAsset: string
  quoteAsset: string
  displayName: string
  pricePrecision: number
  quantityPrecision: number
  minNotional: string
}

export interface Ticker {
  symbol: string
  lastPrice: string
  changePercent: string
  highPrice: string
  lowPrice: string
  volume: string
  quoteVolume: string
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface DepthLevel {
  price: string
  quantity: string
}

export interface OrderBook {
  symbol: string
  bids: DepthLevel[]
  asks: DepthLevel[]
}

export type TradeSide = 'buy' | 'sell'

export interface MarketTrade {
  id: string
  symbol: string
  price: string
  quantity: string
  side: TradeSide
  time: number
}
