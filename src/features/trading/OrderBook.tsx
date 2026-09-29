import { useEffect, useRef, useState } from 'react'
import { add, dec, sub } from '../../lib/decimal'
import { formatPrice, formatQuantity, formatTime } from '../../lib/market/format'
import { subscribeMarket } from '../../lib/market/stream'
import type { DepthLevel, Market, MarketTrade, OrderBook as OrderBookData } from '../../types/market'

interface OrderBookProps {
  market: Market
}

interface DepthRow {
  price: string
  quantity: string
  total: string
}

const LEVELS = 11
const MAX_TRADES = 50

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

function BookRow({
  row,
  side,
  scale,
  precision,
  quantityPrecision,
}: {
  row: DepthRow
  side: 'bid' | 'ask'
  scale: number
  precision: number
  quantityPrecision: number
}) {
  const width = scale > 0 ? Math.min((Number(row.total) / scale) * 100, 100) : 0
  return (
    <div className={`bk-r ${side}`}>
      <i style={{ width: `${width}%` }} />
      <span>{formatPrice(row.price, precision)}</span>
      <span>{formatQuantity(row.quantity, quantityPrecision)}</span>
      <span>{formatQuantity(row.total, quantityPrecision)}</span>
    </div>
  )
}

export function OrderBook({ market }: OrderBookProps) {
  const [tab, setTab] = useState<'book' | 'trades'>('book')
  const [book, setBook] = useState<OrderBookData | null>(null)
  const [trades, setTrades] = useState<MarketTrade[]>([])
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimer = useRef<number | null>(null)

  useEffect(() => {
    setBook(null)
    setTrades([])
    return subscribeMarket(market.symbol, {
      onOrderBook: setBook,
      onTrade: (trade) => {
        setTrades((previous) => [trade, ...previous].slice(0, MAX_TRADES))
        setFlashId(`${trade.id}-${trade.time}`)
        if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
        flashTimer.current = window.setTimeout(() => setFlashId(null), 900)
      },
    })
  }, [market.symbol])

  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
    }
  }, [])

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
  const mid =
    bestBid !== undefined && bestAsk !== undefined
      ? dec(add(bestBid, bestAsk)).div(2).toFixed(market.pricePrecision)
      : null
  const tick = (10 ** -market.pricePrecision).toFixed(market.pricePrecision)

  return (
    <section className="panel book" aria-label="Order book and trades">
      <div className="head">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'book'} onClick={() => setTab('book')}>
            Book
          </button>
          <button type="button" role="tab" aria-selected={tab === 'trades'} onClick={() => setTab('trades')}>
            Trades
          </button>
        </div>
        <span className="mono smoke">{tick}</span>
      </div>

      {tab === 'book' ? (
        <>
          <div className="bk-h">
            <span>Price</span>
            <span>Amount</span>
            <span>Total</span>
          </div>
          {book === null ? <p className="book-state">Waiting for order book…</p> : null}
          <div>
            {[...askRows].reverse().map((row) => (
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
          <div className="spread">
            <b>{mid !== null ? formatPrice(mid, market.pricePrecision) : '—'}</b>
            <span>Spread {spread !== null ? formatPrice(spread, market.pricePrecision) : '—'}</span>
          </div>
          <div>
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
        </>
      ) : trades.length === 0 ? (
        <p className="book-state">Waiting for trades…</p>
      ) : (
        <div className="trades">
          {trades.map((trade) => {
            const id = `${trade.id}-${trade.time}`
            return (
              <div key={id} className={`tr ${flashId === id ? 'flash' : ''}`}>
                <span>{formatTime(trade.time)}</span>
                <span className={trade.side === 'buy' ? 'up' : 'down'}>
                  {formatPrice(trade.price, market.pricePrecision)}
                </span>
                <span>{formatQuantity(trade.quantity, market.quantityPrecision)}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
