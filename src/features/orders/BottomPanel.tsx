import { useState } from 'react'
import { dec } from '../../lib/decimal'
import { formatDateTime, formatPrice, formatQuantity } from '../../lib/market/format'
import { getMarket, marketDisplayName } from '../../lib/markets'
import type { Order } from '../../types/trading'
import type { PaperTrading } from '../trading/usePaperTrading'
import { useTickers } from '../trading/useTickers'

interface BottomPanelProps {
  paper: PaperTrading
}

type Tab = 'positions' | 'open' | 'history'

function usdt(value: string, digits = 2): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  return numeric.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function orderPrice(order: Order): string {
  return order.limitPrice ?? order.filledAvgPrice ?? '—'
}

export function BottomPanel({ paper }: BottomPanelProps) {
  const [tab, setTab] = useState<Tab>('positions')
  const [actionError, setActionError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const tickers = useTickers(paper.positions.map((position) => position.symbol))

  async function handleCancel(orderId: string) {
    setActionError(null)
    setCancellingId(orderId)
    try {
      await paper.cancel(orderId)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Cancel failed.')
    } finally {
      setCancellingId(null)
    }
  }

  const positionValue = paper.positions.reduce(
    (total, position) => total.plus(dec(position.quantity).mul(tickers[position.symbol]?.lastPrice ?? position.avgEntryPrice)),
    dec(0),
  )
  const equity = dec(paper.account?.cashBalance ?? '0').plus(positionValue)

  return (
    <section className="panel orders" aria-label="Orders">
      <div className="head">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'positions'} onClick={() => setTab('positions')}>
            Positions {paper.positions.length}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'open'} onClick={() => setTab('open')}>
            Open orders {paper.openOrders.length}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>
            History
          </button>
        </div>
        <span className="mono smoke">Paper account · {usdt(equity.toFixed(2))} USDT equity</span>
      </div>

      {paper.error ? <p className="book-state">{paper.error}</p> : null}
      {actionError ? <p className="book-state">{actionError}</p> : null}

      {tab === 'positions' ? (
        paper.positions.length === 0 ? (
          <p className="book-state" style={{ padding: '18px 12px', textAlign: 'center' }}>
            No open positions.
          </p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="l">Market</th>
                  <th>Amount</th>
                  <th>Avg entry</th>
                  <th>Mark</th>
                  <th>Unrealized</th>
                </tr>
              </thead>
              <tbody>
                {paper.positions.map((position) => {
                  const market = getMarket(position.symbol)
                  const mark = tickers[position.symbol]?.lastPrice ?? position.avgEntryPrice
                  const pnl = dec(mark).minus(position.avgEntryPrice).mul(position.quantity)
                  const pnlPct = dec(position.avgEntryPrice).isZero()
                    ? dec(0)
                    : pnl.div(dec(position.avgEntryPrice).mul(position.quantity)).mul(100)
                  return (
                    <tr key={position.symbol}>
                      <td className="l">
                        <b>{marketDisplayName(position.symbol)}</b>
                      </td>
                      <td>{formatQuantity(position.quantity, market?.quantityPrecision ?? 6)}</td>
                      <td>{formatPrice(position.avgEntryPrice, market?.pricePrecision ?? 2)}</td>
                      <td>{formatPrice(mark, market?.pricePrecision ?? 2)}</td>
                      <td className={pnl.gt(0) ? 'up' : pnl.lt(0) ? 'down' : undefined}>
                        {pnl.gt(0) ? '+' : ''}
                        {usdt(pnl.toFixed(2))} <small>{pnlPct.toFixed(2)}%</small>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        (() => {
          const rows = tab === 'open' ? paper.openOrders : paper.history
          if (rows.length === 0) {
            return (
              <p className="book-state" style={{ padding: '18px 12px', textAlign: 'center' }}>
                {tab === 'open' ? 'No open orders.' : 'No order history yet.'}
              </p>
            )
          }
          return (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="l">Placed</th>
                    <th className="l">Market</th>
                    <th className="l">Side</th>
                    <th className="l">Type</th>
                    <th>Price</th>
                    <th>Amount</th>
                    {tab === 'history' ? <th>Fee</th> : null}
                    <th className="l">Status</th>
                    {tab === 'open' ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => (
                    <tr key={order.id}>
                      <td className="l">{formatDateTime(order.createdAt)}</td>
                      <td className="l">
                        <b>{marketDisplayName(order.symbol)}</b>
                      </td>
                      <td className={`l side-b ${order.side === 'buy' ? 'up' : 'down'}`}>
                        {order.side.toUpperCase()}
                      </td>
                      <td className="l" style={{ textTransform: 'capitalize' }}>
                        {order.type}
                      </td>
                      <td>{orderPrice(order)}</td>
                      <td>{formatQuantity(order.quantity, getMarket(order.symbol)?.quantityPrecision ?? 6)}</td>
                      {tab === 'history' ? <td>{formatPrice(order.fee, 4)}</td> : null}
                      <td className="l" style={{ textTransform: 'capitalize' }}>
                        {order.status}
                      </td>
                      {tab === 'open' ? (
                        <td>
                          <button
                            type="button"
                            className="cancel"
                            onClick={() => void handleCancel(order.id)}
                            disabled={cancellingId === order.id}
                          >
                            {cancellingId === order.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()
      )}
    </section>
  )
}
