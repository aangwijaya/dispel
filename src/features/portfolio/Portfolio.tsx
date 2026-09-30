import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { dec } from '../../lib/decimal'
import { formatPrice, formatQuantity } from '../../lib/market/format'
import { getMarket, marketDisplayName } from '../../lib/markets'
import { TONE_COLOR } from '../../lib/read/demo'
import { setupForSymbol } from '../../lib/read/lookup'
import { dialSvg } from '../../lib/sigil'
import { fetchTransactions } from '../../lib/transactions'
import type { Transaction } from '../../types/trading'
import type { MarketRead } from '../../types/read'
import type { PaperTrading } from '../trading/usePaperTrading'
import { useTickers } from '../trading/useTickers'
import { EquityChart, type EquityRange } from './EquityChart'

interface PortfolioProps {
  paper: PaperTrading
  read: MarketRead
  onOpenActivity: () => void
  onOpenTrade: (symbol: string) => void
}

const CATEGORY_COLORS = ['#8aa4ff', '#ffc07a', '#c79bff']

const HIST = [
  { day: '20', parts: [100, 0, 0, 0] },
  { day: '21', parts: [100, 0, 0, 0] },
  { day: '22', parts: [84, 0, 0, 16] },
  { day: '23', parts: [73, 12, 0, 15] },
  { day: '24', parts: [66, 13, 0, 21] },
  { day: '25', parts: [69, 13, 0, 18] },
  { day: '26', parts: [52, 24, 24, 0] },
  { day: '27', parts: [48.2, 25.4, 26.4, 0] },
]
const HIST_COLORS = ['cash', '#8aa4ff', '#ffc07a', '#c79bff']

function money(value: string | number, digits = 2): string {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return '—'
  return numeric.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function levelValue(read: MarketRead, symbol: string): number | null {
  const setup = setupForSymbol(read, symbol)
  if (!setup) return null
  const value = Number.parseFloat(setup.invalidation.value.replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

export function Portfolio({ paper, read, onOpenActivity, onOpenTrade }: PortfolioProps) {
  const [range, setRange] = useState<EquityRange>('all')
  const [period, setPeriod] = useState<'today' | '7d'>('7d')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  const tickers = useTickers(paper.positions.map((position) => position.symbol))

  useEffect(() => {
    let cancelled = false
    fetchTransactions()
      .then((rows) => {
        if (!cancelled) setTransactions(rows)
      })
      .catch(() => {
        // The equity panel still renders with the current figures.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if ((event.key === 't' || event.key === 'T') && paper.positions[0]) {
        onOpenTrade(paper.positions[0].symbol)
      }
      if (event.key === 'd' || event.key === 'D') onOpenActivity()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [paper.positions, onOpenTrade, onOpenActivity])

  const netDeposited = transactions
    .filter((transaction) => transaction.asset === 'USDT')
    .reduce(
      (total, transaction) =>
        transaction.kind === 'deposit' ? total.plus(transaction.amount) : total.minus(transaction.amount),
      dec(0),
    )

  const rows = paper.positions.map((position) => {
    const market = getMarket(position.symbol)
    const mark = tickers[position.symbol]?.lastPrice ?? position.avgEntryPrice
    const value = dec(position.quantity).mul(mark)
    const cost = dec(position.quantity).mul(position.avgEntryPrice)
    const pnl = value.minus(cost)
    const pnlPct = cost.isZero() ? dec(0) : pnl.div(cost).mul(100)
    const level = levelValue(read, position.symbol)
    const cushion = level === null || dec(mark).isZero() ? null : dec(mark).minus(level).div(mark).mul(100)
    return { position, market, mark, value, cost, pnl, pnlPct, level, cushion }
  })

  const positionsValue = rows.reduce((total, row) => total.plus(row.value), dec(0))
  const cash = dec(paper.account?.cashBalance ?? '0')
  const equity = cash.plus(positionsValue)
  const unrealized = rows.reduce((total, row) => total.plus(row.pnl), dec(0))
  const unrealizedPct = positionsValue.minus(unrealized).isZero()
    ? dec(0)
    : unrealized.div(positionsValue.minus(unrealized)).mul(100)
  const realized = paper.positions.reduce((total, position) => total.plus(position.realizedPnl), dec(0))
  const fees = paper.history.reduce((total, order) => total.plus(order.fee), dec(0))
  const allTimeGain = equity.minus(netDeposited)
  const cashShare = equity.isZero() ? dec(0) : cash.div(equity).mul(100)

  const allocation = useMemo(() => {
    const entries = [
      { name: 'Cash', sub: 'USDT', value: cash, color: '#9c9c9d', cash: true },
      ...rows
        .slice()
        .sort((a, b) => (b.value.gt(a.value) ? 1 : -1))
        .map((row, index) => ({
          name: row.position.symbol.replace('USDT', ''),
          sub: marketDisplayName(row.position.symbol),
          value: row.value,
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] ?? '#c79bff',
          cash: false,
        })),
    ]
    return entries
  }, [rows, cash])

  const dialParts = allocation.map((entry) => ({
    value: Number(entry.value.toFixed(2)),
    color: entry.color,
    cash: entry.cash,
  }))
  const dialLabel = `Allocation: ${allocation
    .map((entry) => `${entry.name} ${equity.isZero() ? '0' : entry.value.div(equity).mul(100).toFixed(1)}%`)
    .join(', ')}`

  const histNow = useMemo(() => {
    const values = allocation.map((entry) => Number(entry.value.toFixed(2)))
    const total = values.reduce((sum, value) => sum + value, 0) || 1
    const shares = values.map((value) => (value / total) * 100)
    const now = shares.slice(0, 4)
    while (now.length < 4) now.push(0)
    return now
  }, [allocation])

  const closedSells = useMemo(() => {
    const now = Date.now()
    const cutoff = period === 'today' ? new Date().setHours(0, 0, 0, 0) : now - 7 * 24 * 3_600_000
    return paper.history
      .filter((order) => order.side === 'sell' && order.status === 'filled' && order.filledAt !== null)
      .filter((order) => new Date(order.filledAt ?? '').getTime() >= cutoff)
      .sort((a, b) => new Date(b.filledAt ?? '').getTime() - new Date(a.filledAt ?? '').getTime())
  }, [paper.history, period])

  const flatSymbols = useMemo(
    () => new Set(paper.positions.filter((position) => dec(position.quantity).isZero()).map((position) => position.symbol)),
    [paper.positions],
  )

  const realizedBySymbol = useMemo(() => {
    const map = new Map<string, string>()
    for (const position of paper.positions) map.set(position.symbol, position.realizedPnl)
    return map
  }, [paper.positions])

  async function handleCancel(orderId: string) {
    try {
      await paper.cancel(orderId)
      showToast('Order cancelled')
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Cancel failed.')
    }
  }

  const nearest = rows
    .filter((row) => row.cushion !== null)
    .sort((a, b) => Number(a.cushion) - Number(b.cushion))[0]
  const maxWeight = rows.reduce(
    (max, row) => (equity.isZero() ? max : Math.max(max, Number(row.value.div(equity).mul(100)))),
    0,
  )

  return (
    <>
      <section className="panel eq-panel" aria-label="Equity">
        <div className="eq-grid">
          <section>
            <div className="eq-top">
              <div>
                <span className="eyebrow">Paper equity</span>
                <div className="big">
                  {money(equity.toFixed(2))}
                  <small>USDT</small>
                </div>
                <div className="chips">
                  <span className={`chip ${allTimeGain.gte(0) ? 'pos' : ''}`} title="Against net deposited">
                    <b className={allTimeGain.gte(0) ? 'up' : 'down'}>
                      {allTimeGain.gte(0) ? '+' : '−'}
                      {money(allTimeGain.abs().toFixed(2))}
                    </b>
                    <span className={allTimeGain.gte(0) ? 'up' : 'down'}>
                      {netDeposited.isZero()
                        ? '—'
                        : `${allTimeGain.gte(0) ? '+' : '−'}${allTimeGain.abs().div(netDeposited).mul(100).toFixed(2)}%`}
                    </span>{' '}
                    all time
                  </span>
                </div>
              </div>
              <div className="seg" role="group" aria-label="Range">
                {(['24', '72', 'all'] as EquityRange[]).map((value) => (
                  <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)}>
                    {value === '24' ? '24h' : value === '72' ? '3d' : 'All'}
                  </button>
                ))}
              </div>
            </div>
            <EquityChart equity={Number(equity.toFixed(2))} netDeposited={Number(netDeposited.toFixed(2))} range={range} />
            <div className="legend">
              <span>
                <i />
                Equity
              </span>
              <span>
                <i className="base" />
                Net deposited, your own money in
              </span>
              <span>
                <i className="band" />
                Gain above what you put in
              </span>
            </div>
          </section>

          <section className="figs" aria-label="Key figures">
            <div className="fig">
              <span className="k">
                Cash
                <small>{cashShare.toFixed(1)}% of equity</small>
              </span>
              <span className="v">{money(cash.toFixed(2))}</span>
            </div>
            <div className="fig">
              <span className="k">
                Positions
                <small>{rows.length} open</small>
              </span>
              <span className="v">{money(positionsValue.toFixed(2))}</span>
            </div>
            <div className="sep" />
            <div className="fig">
              <span className="k">
                Unrealized P/L
                <small>open positions</small>
              </span>
              <span className={`v ${unrealized.gte(0) ? 'up' : 'down'}`}>
                {unrealized.gte(0) ? '+' : '−'}
                {money(unrealized.abs().toFixed(2))}
                <small className={unrealized.gte(0) ? 'up' : 'down'}>
                  {unrealized.gte(0) ? '+' : '−'}
                  {unrealizedPct.abs().toFixed(2)}%
                </small>
              </span>
            </div>
            <div className="fig">
              <span className="k">
                Realized P/L
                <small>closed trades</small>
              </span>
              <span className={`v ${realized.gte(0) ? 'up' : 'down'}`}>
                {realized.gte(0) ? '+' : '−'}
                {money(realized.abs().toFixed(2))}
                <small className="smoke">{closedSells.length} sells</small>
              </span>
            </div>
            <div className="fig">
              <span className="k">Fees paid</span>
              <span className="v" style={{ color: '#9c9c9d' }}>
                {fees.isZero() ? '0.00' : `−${money(fees.toFixed(2))}`}
                <small className="smoke">0.10% per fill</small>
              </span>
            </div>
            <div className="sep" />
            <div className="fig">
              <span className="k">
                Net deposited
                <small>your money in, minus out</small>
              </span>
              <span className="v">{money(netDeposited.toFixed(2))}</span>
            </div>
            <div className="links">
              <button type="button" className="btn2" onClick={onOpenActivity}>
                Deposit / withdraw
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => onOpenTrade(paper.positions[0]?.symbol ?? 'BTCUSDT')}
              >
                Trade
              </button>
            </div>
          </section>
        </div>
      </section>

      <div className="row2">
        <section className="panel" aria-label="Positions">
          <div className="p-head">
            <div>
              <h4>
                Positions <span className="count">{rows.length}</span>
              </h4>
              <p>Every position checked against the level its setup depends on.</p>
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="empty-note">No open positions yet. Buy something on Trade to see it here.</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="l">Market</th>
                    <th>Quantity</th>
                    <th>Entry → last</th>
                    <th>Value</th>
                    <th>Unrealized P/L</th>
                    <th>Cushion to level</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const tag = read.tags[row.position.symbol.replace('USDT', '')] ?? {
                      label: '—',
                      tone: 'neutral' as const,
                    }
                    const cushionColor =
                      row.cushion === null ? '#9c9c9d' : Number(row.cushion) < 2 ? '#e8b04a' : '#59d499'
                    return (
                      <tr key={row.position.symbol}>
                        <td className="l">
                          <div className="p-mk">
                            <span className="ico">{row.market?.baseAsset.slice(0, 3) ?? '—'}</span>
                            <div>
                              <b>{marketDisplayName(row.position.symbol)}</b>
                              <span className="rtag" style={{ '--c': TONE_COLOR[tag.tone] } as CSSProperties}>
                                <i />
                                {tag.label}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <b>
                            {formatQuantity(
                              row.position.quantity,
                              row.position.quantity.length < 3 ? 4 : (row.market?.quantityPrecision ?? 2),
                            )}
                          </b>
                        </td>
                        <td>
                          {formatPrice(row.position.avgEntryPrice, row.market?.pricePrecision ?? 2)}{' '}
                          <span className="smoke">→</span>{' '}
                          <b>{formatPrice(row.mark, row.market?.pricePrecision ?? 2)}</b>
                        </td>
                        <td>
                          <b>{money(row.value.toFixed(2))}</b>
                        </td>
                        <td>
                          <b className={row.pnl.gte(0) ? 'up' : 'down'}>
                            {row.pnl.gte(0) ? '+' : '−'}
                            {money(row.pnl.abs().toFixed(2))}
                          </b>
                          <small className={row.pnl.gte(0) ? 'up' : 'down'}>
                            {row.pnlPct.gte(0) ? '+' : '−'}
                            {row.pnlPct.abs().toFixed(2)}%
                          </small>
                        </td>
                        <td>
                          {row.cushion === null || row.level === null ? (
                            <span className="smoke">—</span>
                          ) : (
                            <div className="cushion">
                              <div className="t">
                                <span style={{ color: cushionColor }}>{Number(row.cushion).toFixed(1)}%</span>
                                <span className="smoke">{money(row.level, row.market?.pricePrecision ?? 2)}</span>
                              </div>
                              <div className="bar">
                                <i
                                  style={{
                                    width: `${Math.min(Math.max(Number(row.cushion) / 5, 0) * 100, 100)}%`,
                                    '--c': cushionColor,
                                  } as CSSProperties}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td>
                          <button type="button" className="btn2" onClick={() => onOpenTrade(row.position.symbol)}>
                            Trade
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="facts" style={{ marginTop: '4px' }}>
            <span className="eyebrow">Worth knowing</span>
            <ul>
              <li style={{ '--c': '#9c9c9d' } as CSSProperties}>
                About <b>{cashShare.toFixed(0)}% of your equity is cash</b>. Losses can only reach the rest.
              </li>
              <li style={{ '--c': '#8aa4ff' } as CSSProperties}>
                {rows.length === 0 ? (
                  <>No open positions, so <b>nothing is concentrated</b>.</>
                ) : (
                  <>
                    No single position is over <b>{Math.ceil(maxWeight)}% of equity</b>.
                  </>
                )}
              </li>
              <li style={{ '--c': '#e8b04a' } as CSSProperties}>
                {nearest && nearest.level !== null && nearest.cushion !== null ? (
                  <>
                    <b>
                      {nearest.position.symbol.replace('USDT', '')} is {Number(nearest.cushion).toFixed(1)}% above its{' '}
                      {money(nearest.level, nearest.market?.pricePrecision ?? 2)}
                    </b>{' '}
                    invalidation level.
                  </>
                ) : (
                  <>
                    <b>No open position has a documented level yet.</b>
                  </>
                )}
              </li>
            </ul>
            <div className="foot">Facts about your account, not advice.</div>
          </div>
        </section>

        <section className="panel" aria-label="Allocation">
          <div className="p-head">
            <div>
              <h4>Allocation</h4>
              <p>Where your equity sits right now.</p>
            </div>
          </div>
          <div className="alloc">
            <div className="alloc-top">
              <div
                className="dial"
                role="img"
                aria-label={dialLabel}
                dangerouslySetInnerHTML={{ __html: dialSvg(dialParts, 'alloc') }}
              />
              <ul className="a-list">
                {allocation.map((entry) => (
                  <li key={entry.name}>
                    <span
                      className="sw"
                      style={
                        {
                          '--c': entry.color,
                          ...(entry.cash
                            ? {
                                background:
                                  'repeating-linear-gradient(135deg, rgba(156,156,157,.7) 0 2px, rgba(156,156,157,.35) 2px 4px)',
                              }
                            : {}),
                        } as CSSProperties
                      }
                    />
                    <span>
                      <b>{entry.name}</b> <span className="smoke" style={{ fontSize: '11px' }}>{entry.sub}</span>
                    </span>
                    <span className="num">{money(entry.value.toFixed(2))}</span>
                    <span className="p">
                      {equity.isZero() ? '0.0' : entry.value.div(equity).mul(100).toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="hist-h">
              <span className="eyebrow">Last 7 days</span>
              <span className="mono smoke">share of equity at 00:00 UTC</span>
            </div>
            <div className="hist" title="History is demo design data" role="img" aria-label="Allocation by day (demo design data)">
              {HIST.map((column, index) => {
                const parts = index === HIST.length - 1 ? histNow : column.parts
                return (
                  <div key={column.day} className={`col ${index === HIST.length - 1 ? 'now' : ''}`}>
                    <div className="bars">
                      {parts.map((value, partIndex) =>
                        value > 0 ? (
                          <i
                            key={partIndex}
                            className={HIST_COLORS[partIndex] === 'cash' ? 'cash' : undefined}
                            style={
                              {
                                flex: value,
                                '--c': HIST_COLORS[partIndex] === 'cash' ? undefined : HIST_COLORS[partIndex],
                              } as CSSProperties
                            }
                          />
                        ) : null,
                      )}
                    </div>
                    <span>{index === HIST.length - 1 ? 'Now' : column.day}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>

      <div className="row2">
        <section className="panel" aria-label="Closed trades">
          <div className="p-head">
            <div>
              <h4>
                Closed trades <span className="count">{closedSells.length}</span>
              </h4>
              <p>Realized P/L from every position you have sold.</p>
            </div>
            <div className="seg" role="group" aria-label="Period">
              <button type="button" aria-pressed={period === 'today'} onClick={() => setPeriod('today')}>
                Today
              </button>
              <button type="button" aria-pressed={period === '7d'} onClick={() => setPeriod('7d')}>
                7 days
              </button>
            </div>
          </div>
          {closedSells.length === 0 ? (
            <div className="empty-note">No sells in this period. Closed trades appear here after you sell.</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="l">Closed</th>
                    <th className="l">Market</th>
                    <th>Quantity</th>
                    <th>Exit price</th>
                    <th>Fee</th>
                    <th>Realized P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {closedSells.map((order) => {
                    const market = getMarket(order.symbol)
                    const cumulative = realizedBySymbol.get(order.symbol)
                    const closed = flatSymbols.has(order.symbol)
                    return (
                      <tr key={order.id}>
                        <td className="l smoke">
                          {order.filledAt ? new Date(order.filledAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="l">
                          <div className="p-mk">
                            <span className="ico">{market?.baseAsset.slice(0, 3) ?? '—'}</span>
                            <b>{marketDisplayName(order.symbol)}</b>
                          </div>
                        </td>
                        <td>{formatQuantity(order.filledQuantity, market?.quantityPrecision ?? 6)}</td>
                        <td>{order.filledAvgPrice ? formatPrice(order.filledAvgPrice, market?.pricePrecision ?? 2) : '—'}</td>
                        <td>{money(order.fee, 2)}</td>
                        <td>
                          {closed && cumulative !== undefined ? (
                            <b className={dec(cumulative).gte(0) ? 'up' : 'down'}>
                              {dec(cumulative).gte(0) ? '+' : '−'}
                              {money(dec(cumulative).abs().toFixed(2))}
                            </b>
                          ) : (
                            <span className="smoke" title="Position still open; realized P/L is tracked per market.">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel" aria-label="Open orders">
          <div className="p-head">
            <div>
              <h4>
                Open orders <span className="count">{paper.openOrders.length}</span>
              </h4>
              <p>Waiting to fill at your price.</p>
            </div>
          </div>
          {paper.openOrders.length === 0 ? (
            <div className="empty-note">No open orders. Place a limit order on Trade.</div>
          ) : (
            <div className="oo">
              {paper.openOrders.map((order) => {
                const market = getMarket(order.symbol)
                const last = market ? tickers[order.symbol]?.lastPrice : undefined
                const limit = order.limitPrice
                const distance =
                  last && limit ? ((Number(last) / Number(limit) - 1) * 100).toFixed(1) : null
                const marker =
                  last && limit ? Math.min(Math.max((Number(limit) / Number(last)) * 100, 0), 100) : 50
                return (
                  <div className="oo-row" key={order.id}>
                    <span className="ico">{market?.baseAsset.slice(0, 3) ?? '—'}</span>
                    <div>
                      <b>
                        {order.side === 'buy' ? 'Buy' : 'Sell'} {formatQuantity(order.quantity, market?.quantityPrecision ?? 6)}{' '}
                        {market?.baseAsset ?? order.symbol}
                      </b>{' '}
                      <span className="smoke" style={{ fontSize: '12px' }}>
                        {order.type} {limit ? formatPrice(limit, market?.pricePrecision ?? 2) : ''}
                      </span>
                      <small>
                        Placed {new Date(order.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UTC
                      </small>
                      <div className="fill" title={last && limit ? `Last ${last}, limit ${limit}` : undefined}>
                        <i style={{ left: `${marker}%` }} />
                      </div>
                      {distance !== null ? (
                        <small style={{ marginTop: '4px' }}>
                          {Math.abs(Number(distance)).toFixed(1)}% {Number(distance) >= 0 ? 'above' : 'below'} your limit
                        </small>
                      ) : null}
                    </div>
                    <button type="button" className="btn2" onClick={() => void handleCancel(order.id)}>
                      Cancel
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <div className="empty-note">Orders fill when the live price crosses your limit. Manage them on Trade.</div>
        </section>
      </div>

      {toast ? <div className="toast">{toast}</div> : null}
    </>
  )
}
