import { useState } from 'react'
import { formatDateTime, formatPrice, formatQuantity } from '../../lib/market/format'
import { getMarket, marketDisplayName } from '../../lib/markets'
import type { Order } from '../../types/trading'
import type { PaperTrading } from '../trading/usePaperTrading'

interface BottomPanelProps {
  paper: PaperTrading
}

function StatusBadge({ status }: { status: Order['status'] }) {
  const tone =
    status === 'filled'
      ? 'bg-buy/15 text-buy'
      : status === 'cancelled'
        ? 'bg-sell/15 text-sell'
        : 'bg-warn/15 text-warn'
  return (
    <span className={`rounded-pill px-1.5 py-0.5 text-micro font-medium ${tone}`}>{status}</span>
  )
}

function orderPrice(order: Order): string {
  const price = order.limitPrice ?? order.filledAvgPrice
  return price ?? '—'
}

export function BottomPanel({ paper }: BottomPanelProps) {
  const [tab, setTab] = useState<'open' | 'history'>('open')
  const [actionError, setActionError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

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

  const rows = tab === 'open' ? paper.openOrders : paper.history

  return (
    <section className="flex h-56 shrink-0 flex-col bg-panel">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-edge px-2">
        <button
          type="button"
          onClick={() => setTab('open')}
          className={`h-6 rounded-md px-2 text-micro font-medium ${
            tab === 'open' ? 'bg-inset text-ink' : 'text-faint hover:text-ink'
          }`}
        >
          Open orders ({paper.openOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`h-6 rounded-md px-2 text-micro font-medium ${
            tab === 'history' ? 'bg-inset text-ink' : 'text-faint hover:text-ink'
          }`}
        >
          Order history ({paper.history.length})
        </button>
        <span className="ml-auto text-micro text-faint">
          {paper.loading ? 'Loading…' : `${paper.positions.length} open positions`}
        </span>
      </div>

      {paper.error ? (
        <p className="border-b border-edge px-3 py-1.5 text-micro text-sell">{paper.error}</p>
      ) : null}
      {actionError ? (
        <p className="border-b border-edge px-3 py-1.5 text-micro text-sell">{actionError}</p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-caption text-faint">
            {tab === 'open' ? 'No open orders.' : 'No order history yet.'}
          </p>
        ) : (
          <table className="w-full text-caption">
            <thead className="sticky top-0 bg-panel text-micro uppercase tracking-wide text-faint">
              <tr className="border-b border-hairline">
                <th className="px-3 py-1.5 text-left font-medium">Time</th>
                <th className="px-3 py-1.5 text-left font-medium">Market</th>
                <th className="px-3 py-1.5 text-left font-medium">Side</th>
                <th className="px-3 py-1.5 text-left font-medium">Type</th>
                <th className="px-3 py-1.5 text-right font-medium">Price</th>
                <th className="px-3 py-1.5 text-right font-medium">Amount</th>
                <th className="px-3 py-1.5 text-right font-medium">Fee</th>
                <th className="px-3 py-1.5 text-left font-medium">Status</th>
                <th className="px-3 py-1.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id} className="border-b border-hairline hover:bg-inset">
                  <td className="whitespace-nowrap px-3 py-1 text-faint">{formatDateTime(order.createdAt)}</td>
                  <td className="px-3 py-1 font-medium text-ink">{marketDisplayName(order.symbol)}</td>
                  <td className={`px-3 py-1 font-medium ${order.side === 'buy' ? 'text-buy' : 'text-sell'}`}>
                    {order.side.toUpperCase()}
                  </td>
                  <td className="px-3 py-1 capitalize text-body">{order.type}</td>
                  <td className="px-3 py-1 text-right tabular-nums text-body">{orderPrice(order)}</td>
                  <td className="px-3 py-1 text-right tabular-nums text-body">
                    {formatQuantity(order.quantity, getMarket(order.symbol)?.quantityPrecision ?? 6)}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums text-faint">
                    {formatPrice(order.fee, 4)}
                  </td>
                  <td className="px-3 py-1">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-3 py-1 text-right">
                    {order.status === 'open' ? (
                      <button
                        type="button"
                        onClick={() => void handleCancel(order.id)}
                        disabled={cancellingId === order.id}
                        className="rounded-md border border-edge px-2 py-0.5 text-micro text-body hover:bg-panel hover:text-sell disabled:opacity-50"
                      >
                        {cancellingId === order.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
