import type { ReactNode } from 'react'
import { add, dec, mul, percentChange, sub } from '../../lib/decimal'
import { formatPrice, formatQuantity, formatSigned } from '../../lib/market/format'
import { marketDisplayName } from '../../lib/markets'
import { useTickers } from '../trading/useTickers'
import type { PaperTrading } from '../trading/usePaperTrading'

interface PortfolioProps {
  paper: PaperTrading
  onOpenActivity: () => void
}

interface SummaryCardProps {
  label: string
  value: string
  tone?: 'default' | 'up' | 'down'
  action?: ReactNode
}

function SummaryCard({ label, value, tone = 'default', action }: SummaryCardProps) {
  const toneClass = tone === 'up' ? 'text-buy' : tone === 'down' ? 'text-sell' : 'text-ink'
  return (
    <div className="rounded-card border border-edge bg-panel p-4">
      <p className="text-micro uppercase tracking-wide text-faint">{label}</p>
      <p className={`mt-1 text-heading-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function Portfolio({ paper, onOpenActivity }: PortfolioProps) {
  const tickers = useTickers(paper.positions.map((position) => position.symbol))

  let positionsValue = '0'
  let costBasis = '0'
  let pricedPositions = 0

  for (const position of paper.positions) {
    const ticker = tickers[position.symbol]
    if (!ticker) continue
    positionsValue = add(positionsValue, mul(ticker.lastPrice, position.quantity))
    costBasis = add(costBasis, mul(position.avgEntryPrice, position.quantity))
    pricedPositions += 1
  }

  const cash = paper.account?.cashBalance ?? null
  const unrealizedPnl = pricedPositions > 0 ? sub(positionsValue, costBasis) : '0'
  const unrealizedPnlPercent = pricedPositions > 0 ? percentChange(costBasis, positionsValue) : null
  const equity = cash !== null ? add(cash, positionsValue) : null
  const missingMarks = paper.positions.length - pricedPositions

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-edge bg-panel px-4 py-3">
        <h2 className="text-heading font-semibold tracking-tight text-ink">Portfolio</h2>
        <p className="mt-0.5 text-micro text-faint">
          Paper account · balances settle immediately on each fill
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 p-4">
        <SummaryCard
          label="Cash balance"
          value={cash !== null ? `${formatPrice(cash, 2)} USDT` : '—'}
          action={
            <button
              type="button"
              onClick={onOpenActivity}
              className="h-6 rounded-pill border border-edge px-2.5 text-micro font-medium text-body hover:bg-inset hover:text-ink"
            >
              Deposit / withdraw
            </button>
          }
        />
        <SummaryCard
          label="Positions value"
          value={`${formatPrice(positionsValue, 2)} USDT`}
        />
        <SummaryCard label="Total equity" value={equity !== null ? `${formatPrice(equity, 2)} USDT` : '—'} />
        <SummaryCard
          label="Unrealized P/L"
          value={
            pricedPositions > 0
              ? `${formatSigned(unrealizedPnl, 2)} USDT${
                  unrealizedPnlPercent !== null ? ` (${formatSigned(unrealizedPnlPercent, 2)}%)` : ''
                }`
              : '—'
          }
          tone={
            pricedPositions === 0
              ? 'default'
              : dec(unrealizedPnl).gt(0)
                ? 'up'
                : dec(unrealizedPnl).lt(0)
                  ? 'down'
                  : 'default'
          }
        />
      </div>

      {paper.error ? (
        <p className="mx-4 mb-3 rounded-card border border-sell/40 bg-sell/10 px-3 py-2 text-caption text-sell">
          {paper.error}
        </p>
      ) : null}

      <div className="mx-4 mb-4 min-h-0 flex-1 overflow-hidden rounded-card border border-edge bg-panel">
        <div className="flex h-9 items-center justify-between border-b border-edge px-4">
          <span className="text-caption font-semibold text-ink">Positions</span>
          {missingMarks > 0 ? (
            <span className="text-micro text-warn">
              {missingMarks} position{missingMarks > 1 ? 's' : ''} waiting for a live price
            </span>
          ) : null}
        </div>

        {paper.positions.length === 0 ? (
          <p className="px-4 py-10 text-center text-caption text-faint">
            {paper.loading ? 'Loading positions…' : 'No open positions. Place a paper order to get started.'}
          </p>
        ) : (
          <table className="w-full text-caption">
            <thead className="text-micro uppercase tracking-wide text-faint">
              <tr className="border-b border-hairline">
                <th className="px-4 py-2 text-left font-medium">Market</th>
                <th className="px-4 py-2 text-right font-medium">Quantity</th>
                <th className="px-4 py-2 text-right font-medium">Avg entry</th>
                <th className="px-4 py-2 text-right font-medium">Last price</th>
                <th className="px-4 py-2 text-right font-medium">Market value</th>
                <th className="px-4 py-2 text-right font-medium">Unrealized P/L</th>
              </tr>
            </thead>
            <tbody>
              {paper.positions.map((position) => {
                const ticker = tickers[position.symbol]
                const lastPrice = ticker?.lastPrice ?? null
                const marketValue =
                  lastPrice !== null ? mul(lastPrice, position.quantity) : null
                const pnl =
                  lastPrice !== null
                    ? mul(sub(lastPrice, position.avgEntryPrice), position.quantity)
                    : null
                const pnlPercent =
                  lastPrice !== null ? percentChange(position.avgEntryPrice, lastPrice) : null

                return (
                  <tr key={position.symbol} className="border-b border-hairline hover:bg-inset">
                    <td className="px-4 py-2 font-medium text-ink">
                      {marketDisplayName(position.symbol)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-body">
                      {formatQuantity(position.quantity, 8)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-body">
                      {formatPrice(position.avgEntryPrice, 2)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-body">
                      {formatPrice(lastPrice, 2)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-body">
                      {marketValue !== null ? formatPrice(marketValue, 2) : '—'}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums ${
                        pnl === null ? 'text-faint' : dec(pnl).gt(0) ? 'text-buy' : dec(pnl).lt(0) ? 'text-sell' : 'text-body'
                      }`}
                    >
                      {pnl !== null
                        ? `${formatSigned(pnl, 2)}${
                            pnlPercent !== null ? ` (${formatSigned(pnlPercent, 2)}%)` : ''
                          }`
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
