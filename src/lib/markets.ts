import type { Market } from '../types/market'

export const MARKETS: Market[] = [
  { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', displayName: 'BTC/USDT', pricePrecision: 2, quantityPrecision: 6, minNotional: '5' },
  { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', displayName: 'ETH/USDT', pricePrecision: 2, quantityPrecision: 5, minNotional: '5' },
  { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT', displayName: 'BNB/USDT', pricePrecision: 2, quantityPrecision: 4, minNotional: '5' },
  { symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT', displayName: 'SOL/USDT', pricePrecision: 3, quantityPrecision: 2, minNotional: '5' },
  { symbol: 'XRPUSDT', baseAsset: 'XRP', quoteAsset: 'USDT', displayName: 'XRP/USDT', pricePrecision: 4, quantityPrecision: 1, minNotional: '5' },
  { symbol: 'ADAUSDT', baseAsset: 'ADA', quoteAsset: 'USDT', displayName: 'ADA/USDT', pricePrecision: 4, quantityPrecision: 1, minNotional: '5' },
  { symbol: 'DOGEUSDT', baseAsset: 'DOGE', quoteAsset: 'USDT', displayName: 'DOGE/USDT', pricePrecision: 5, quantityPrecision: 1, minNotional: '5' },
  { symbol: 'AVAXUSDT', baseAsset: 'AVAX', quoteAsset: 'USDT', displayName: 'AVAX/USDT', pricePrecision: 3, quantityPrecision: 2, minNotional: '5' },
  { symbol: 'LINKUSDT', baseAsset: 'LINK', quoteAsset: 'USDT', displayName: 'LINK/USDT', pricePrecision: 3, quantityPrecision: 2, minNotional: '5' },
  { symbol: 'DOTUSDT', baseAsset: 'DOT', quoteAsset: 'USDT', displayName: 'DOT/USDT', pricePrecision: 3, quantityPrecision: 2, minNotional: '5' },
  { symbol: 'LTCUSDT', baseAsset: 'LTC', quoteAsset: 'USDT', displayName: 'LTC/USDT', pricePrecision: 2, quantityPrecision: 3, minNotional: '5' },
  { symbol: 'UNIUSDT', baseAsset: 'UNI', quoteAsset: 'USDT', displayName: 'UNI/USDT', pricePrecision: 3, quantityPrecision: 2, minNotional: '5' },
  { symbol: 'ATOMUSDT', baseAsset: 'ATOM', quoteAsset: 'USDT', displayName: 'ATOM/USDT', pricePrecision: 3, quantityPrecision: 2, minNotional: '5' },
  { symbol: 'NEARUSDT', baseAsset: 'NEAR', quoteAsset: 'USDT', displayName: 'NEAR/USDT', pricePrecision: 3, quantityPrecision: 2, minNotional: '5' },
  { symbol: 'APTUSDT', baseAsset: 'APT', quoteAsset: 'USDT', displayName: 'APT/USDT', pricePrecision: 3, quantityPrecision: 2, minNotional: '5' },
  { symbol: 'ARBUSDT', baseAsset: 'ARB', quoteAsset: 'USDT', displayName: 'ARB/USDT', pricePrecision: 4, quantityPrecision: 1, minNotional: '5' },
  { symbol: 'OPUSDT', baseAsset: 'OP', quoteAsset: 'USDT', displayName: 'OP/USDT', pricePrecision: 4, quantityPrecision: 1, minNotional: '5' },
  { symbol: 'SUIUSDT', baseAsset: 'SUI', quoteAsset: 'USDT', displayName: 'SUI/USDT', pricePrecision: 4, quantityPrecision: 1, minNotional: '5' },
]

export const DEFAULT_SYMBOL = 'BTCUSDT'

export function getMarket(symbol: string): Market | undefined {
  return MARKETS.find((market) => market.symbol === symbol)
}

export function marketDisplayName(symbol: string): string {
  return getMarket(symbol)?.displayName ?? symbol
}
