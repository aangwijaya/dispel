import type { MarketRead, Setup } from '../../types/read'

export function baseAssetOf(symbol: string): string {
  return symbol.includes('/') ? (symbol.split('/')[0] ?? symbol) : symbol.replace(/USDT$/, '')
}

/** Setup context for a market, from the current read (live or fallback). */
export function setupForSymbol(read: MarketRead, symbol: string): Setup | null {
  const base = baseAssetOf(symbol)
  return [...read.setups, ...read.forming].find((item) => baseAssetOf(item.symbol) === base) ?? null
}
