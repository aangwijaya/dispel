import { useEffect, useState } from 'react'
import { formatPrice, formatQuantity, formatTime } from '../../lib/market/format'
import { subscribeMarket } from '../../lib/market/stream'
import type { Market, MarketTrade } from '../../types/market'

interface RecentTradesProps {
  market: Market
}

const MAX_TRADES = 50

export function RecentTrades({ market }: RecentTradesProps) {
  const [trades, setTrades] = useState<MarketTrade[]>([])

  useEffect(() => {
    setTrades([])
    return subscribeMarket(market.symbol, {
      onTrade: (trade) => {
        setTrades((previous) => [trade, ...previous].slice(0, MAX_TRADES))
      },
    })
  }, [market.symbol])

  return (
    <section>
      <div className="flex h-8 items-center justify-between border-b border-hairline px-3">
        <span className="text-micro font-semibold uppercase tracking-wide text-faint">Recent trades</span>
        <span className="text-micro text-faint">Price / Amount / Time</span>
      </div>
      <div className="grid grid-cols-3 px-3 py-1 text-micro text-faint">
        <span>Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Time</span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {trades.length === 0 ? (
          <p className="px-3 py-2 text-micro text-faint">Waiting for trades…</p>
        ) : (
          trades.map((trade) => (
            <div
              key={`${trade.id}-${trade.time}`}
              className="grid h-5 grid-cols-3 items-center px-3 text-micro tabular-nums"
            >
              <span className={trade.side === 'buy' ? 'text-buy' : 'text-sell'}>
                {formatPrice(trade.price, market.pricePrecision)}
              </span>
              <span className="text-right text-body">
                {formatQuantity(trade.quantity, market.quantityPrecision)}
              </span>
              <span className="text-right text-faint">{formatTime(trade.time)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
