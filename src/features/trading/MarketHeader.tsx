import { useEffect, useState } from 'react'
import { subscribeMarket } from '../../lib/market/stream'
import { formatCompact, formatPrice } from '../../lib/market/format'
import { PriceChange } from '../../components/PriceChange'
import type { Market, Ticker } from '../../types/market'

interface MarketHeaderProps {
  market: Market
}

interface StatProps {
  label: string
  value: string
}

function Stat({ label, value }: StatProps) {
  return (
    <div>
      <p className="text-micro uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-0.5 text-caption tabular-nums text-body">{value}</p>
    </div>
  )
}

export function MarketHeader({ market }: MarketHeaderProps) {
  const [ticker, setTicker] = useState<Ticker | null>(null)

  useEffect(() => {
    setTicker(null)
    return subscribeMarket(market.symbol, { onTicker: setTicker })
  }, [market.symbol])

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-edge bg-panel px-4 py-2.5">
      <div className="flex items-baseline gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-heading font-semibold tracking-tight text-ink">{market.displayName}</h2>
            <span className="text-micro text-faint">{market.baseAsset} · Spot</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-3">
            <span className="text-heading-lg font-semibold tabular-nums text-ink">
              {formatPrice(ticker?.lastPrice, market.pricePrecision)}
            </span>
            <PriceChange value={ticker?.changePercent} className="text-caption" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <Stat label="24h High" value={formatPrice(ticker?.highPrice, market.pricePrecision)} />
        <Stat label="24h Low" value={formatPrice(ticker?.lowPrice, market.pricePrecision)} />
        <Stat label="24h Vol" value={formatCompact(ticker?.volume)} />
        <Stat label="24h Quote Vol" value={formatCompact(ticker?.quoteVolume)} />
      </div>
    </header>
  )
}
