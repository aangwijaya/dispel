import { useEffect, useState } from 'react'
import { add, sub } from '../../lib/decimal'
import { formatPrice, formatQuantity } from '../../lib/market/format'
import { subscribeMarket } from '../../lib/market/stream'
import type { DepthLevel, Market, OrderBook as OrderBookData } from '../../types/market'

interface OrderBookProps {
  market: Market
}

interface DepthRow {
  price: string
  quantity: string
  total: string
}

const LEVELS = 11

function buildRows(levels: DepthLevel[]): DepthRow[] {
  const rows: DepthRow[] = []
  let total = '0'
  for (const level of levels.slice(0, LEVELS)) {
    total = add(total, level.quantity)
    rows.push({ price: level.price, quantity: level.quantity, total })
  }
  return rows
}

function maxTotal(rows: DepthRow[]): number {
  const last = rows[rows.length - 1]
  if (!last) return 0
  const numeric = Number(last.total)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

interface RowProps {
  row: DepthRow
  side: 'bid' | 'ask'
  scale: number
  precision: number
  quantityPrecision: number
}

function BookRow({ row, side, scale, precision, quantityPrecision }: RowProps) {
  const width = scale > 0 ? Math.min((Number(row.total) / scale) * 100, 100) : 0
  return (
    <div className="relative grid h-5 grid-cols-3 items-center px-3 text-micro tabular-nums">
      <div
        className={`absolute inset-y-0 right-0 ${side === 'bid' ? 'bg-buy/10' : 'bg-sell/10'}`}
        style={{ width: `${width}%` }}
      />
      <span className={`relative ${side === 'bid' ? 'text-buy' : 'text-sell'}`}>
        {formatPrice(row.price, precision)}
      </span>
      <span className="relative text-right text-body">{formatQuantity(row.quantity, quantityPrecision)}</span>
      <span className="relative text-right text-faint">{formatQuantity(row.total, quantityPrecision)}</span>
    </div>
  )
}

export function OrderBook({ market }: OrderBookProps) {
  const [book, setBook] = useState<OrderBookData | null>(null)

  useEffect(() => {
    setBook(null)
    return subscribeMarket(market.symbol, { onOrderBook: setBook })
  }, [market.symbol])

  const bidRows = buildRows(book?.bids ?? [])
  const askRows = buildRows(book?.asks ?? [])
  const bidScale = maxTotal(bidRows)
  const askScale = maxTotal(askRows)

  const bestBid = bidRows[0]?.price
  const bestAsk = askRows[0]?.price
  const spread =
    bestBid !== undefined && bestAsk !== undefined && Number(bestAsk) > Number(bestBid)
      ? sub(bestAsk, bestBid)
      : null

  return (
    <section className="border-b border-edge">
      <div className="flex h-8 items-center justify-between border-b border-hairline px-3">
        <span className="text-micro font-semibold uppercase tracking-wide text-faint">Order book</span>
        <span className="text-micro text-faint">Price / Amount / Total</span>
      </div>

      <div className="grid grid-cols-3 px-3 py-1 text-micro text-faint">
        <span>Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
      </div>

      {book === null ? (
        <p className="px-3 py-3 text-micro text-faint">Waiting for order book…</p>
      ) : null}

      <div className="flex max-h-44 flex-col-reverse overflow-y-auto">
        {askRows.map((row) => (
          <BookRow
            key={`ask-${row.price}`}
            row={row}
            side="ask"
            scale={askScale}
            precision={market.pricePrecision}
            quantityPrecision={market.quantityPrecision}
          />
        ))}
      </div>

      <div className="flex h-7 items-center justify-between border-y border-hairline px-3">
        <span className="text-micro text-faint">Spread</span>
        <span className="text-caption tabular-nums text-ink">
          {spread !== null ? formatPrice(spread, market.pricePrecision) : '—'}
        </span>
      </div>

      <div className="flex max-h-44 flex-col overflow-y-auto">
        {bidRows.map((row) => (
          <BookRow
            key={`bid-${row.price}`}
            row={row}
            side="bid"
            scale={bidScale}
            precision={market.pricePrecision}
            quantityPrecision={market.quantityPrecision}
          />
        ))}
      </div>
    </section>
  )
}
