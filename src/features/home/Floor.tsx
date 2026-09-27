import { useMemo, useState, type CSSProperties } from 'react'
import { MARKETS, getMarket } from '../../lib/markets'
import { dec } from '../../lib/decimal'
import { formatPrice } from '../../lib/market/format'
import { TONE_COLOR, series } from '../../lib/read/demo'
import type { Market } from '../../types/market'
import type { MarketRead } from '../../types/read'
import type { PaperTrading } from '../trading/usePaperTrading'
import { useTickers } from '../trading/useTickers'
import { useWatchlist } from '../trading/useWatchlist'
import { Sparkline } from './Sparkline'
import { Pct } from './Pct'
import { useSparklines } from './useSparklines'

type MoversTab = 'gainers' | 'losers' | 'volume'

interface FloorProps {
  userId: string
  read: MarketRead
  paper: PaperTrading
  onOpenTrade: () => void
  onOpenPortfolio: () => void
  onOpenActivity: () => void
}

function usdt(value: string, digits = 2): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  return numeric.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function Floor({ userId, read, paper, onOpenTrade, onOpenPortfolio, onOpenActivity }: FloorProps) {
  const [tab, setTab] = useState<MoversTab>('gainers')
  const watch = useWatchlist(userId)
  const tickers = useTickers(MARKETS.map((market) => market.symbol))

  const watchSymbols = watch.symbols.slice(0, 5)
  const watchMarkets = watchSymbols
    .map((symbol) => getMarket(symbol))
    .filter((market): market is Market => market !== undefined)
  const sparklines = useSparklines(watchSymbols)

  const movers = useMemo(() => {
    const ranked = MARKETS.map((market) => ({ market, ticker: tickers[market.symbol] })).filter(
      (entry) => entry.ticker !== undefined,
    )
    const byChange = [...ranked].sort(
      (a, b) => Number(b.ticker?.changePercent ?? 0) - Number(a.ticker?.changePercent ?? 0),
    )
    if (tab === 'gainers') return byChange.slice(0, 5)
    if (tab === 'losers') return byChange.reverse().slice(0, 5)
    return [...ranked]
      .sort((a, b) => Number(b.ticker?.quoteVolume ?? 0) - Number(a.ticker?.quoteVolume ?? 0))
      .slice(0, 5)
  }, [tickers, tab])

  const positionValue = paper.positions.reduce(
    (total, position) => total.plus(dec(position.quantity).mul(tickers[position.symbol]?.lastPrice ?? position.avgEntryPrice)),
    dec(0),
  )
  const costBasis = paper.positions.reduce(
    (total, position) => total.plus(dec(position.quantity).mul(position.avgEntryPrice)),
    dec(0),
  )
  const equity = dec(paper.account?.cashBalance ?? '0').plus(positionValue)
  const unrealized = positionValue.minus(costBasis)
  const unrealizedPct = costBasis.isZero() ? dec(0) : unrealized.div(costBasis).mul(100)
  const equityShape = series([10002, 10060, 9980, 10110, 10240, 10190, 10330, 10482], 21, 60)

  return (
    <section className="panel floor" aria-label="Markets and account">
      <section>
        <div className="p-head">
          <h3>Watchlist</h3>
          <button type="button" className="link" onClick={onOpenTrade}>
            All markets
          </button>
        </div>
        {watchMarkets.length === 0 ? (
          <div className="empty-note">No markets on your watchlist yet. Add one from Trade.</div>
        ) : (
          <table className="tbl floor-tbl">
            <thead>
              <tr>
                <th>Market</th>
                <th>Last</th>
                <th>24h</th>
                <th className="c-spark">24h</th>
                <th>Read</th>
              </tr>
            </thead>
            <tbody>
              {watchMarkets.map((market) => {
                const ticker = tickers[market.symbol]
                const change = Number(ticker?.changePercent ?? 0)
                const tag = read.tags[market.baseAsset] ?? { label: '—', tone: 'neutral' as const }
                const spark = sparklines[market.symbol]
                return (
                  <tr key={market.symbol}>
                    <td>
                      <b>{market.displayName}</b>
                    </td>
                    <td>{formatPrice(ticker?.lastPrice, market.pricePrecision)}</td>
                    <td>
                      <Pct value={change} />
                    </td>
                    <td className="c-spark">
                      {spark && spark.length > 1 ? (
                        <Sparkline values={spark} color={change >= 0 ? '#59d499' : '#f0506e'} />
                      ) : null}
                    </td>
                    <td>
                      <span className="rtag" style={{ '--c': TONE_COLOR[tag.tone] } as CSSProperties}>
                        <i />
                        {tag.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <div className="p-head">
          <h3>Market</h3>
          <span className="mono smoke">{read.coverage} USDT pairs</span>
        </div>
        <div className="breadth">
          <div className="lab">
            <span>
              <b className="up num">{read.breadth.up}</b> up
            </span>
            <span>Breadth</span>
            <span>
              <b className="down num">{read.breadth.down}</b> down
            </span>
          </div>
          <div className="bar">
            <i style={{ flex: read.breadth.up }} />
            <i style={{ flex: read.breadth.down }} />
          </div>
        </div>
        <div className="tabs" role="tablist">
          {(['gainers', 'losers', 'volume'] as MoversTab[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
            >
              {value === 'gainers' ? 'Gainers' : value === 'losers' ? 'Losers' : 'Volume'}
            </button>
          ))}
        </div>
        <table className="tbl floor-tbl">
          <tbody>
            {movers.map(({ market, ticker }) => (
              <tr key={market.symbol}>
                <td>
                  <b>{market.displayName}</b>
                </td>
                <td>{formatPrice(ticker?.lastPrice, market.pricePrecision)}</td>
                <td>
                  <Pct value={Number(ticker?.changePercent ?? 0)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="acct">
        <div className="p-head">
          <h3>Paper account</h3>
          <span className="mono smoke">USDT</span>
        </div>
        <div className="acct-figs">
          <div className="full">
            <div className="k">Total equity · 7 days</div>
            <div className="v lg">{usdt(equity.toFixed(2))}</div>
            <div className="eq" title="The 7-day shape is demo design data">
              <Sparkline values={equityShape} color="#59d499" stretch />
            </div>
          </div>
          <div>
            <div className="k">Cash</div>
            <div className="v">{usdt(paper.account?.cashBalance ?? '0')}</div>
          </div>
          <div>
            <div className="k">Unrealized P/L</div>
            <div className={`v ${unrealized.gt(0) ? 'up' : unrealized.lt(0) ? 'down' : ''}`}>
              {unrealized.gt(0) ? '+' : ''}
              {usdt(unrealized.toFixed(2))} <small>{unrealizedPct.toFixed(2)}%</small>
            </div>
          </div>
          <div>
            <div className="k">Positions</div>
            <div className="v">
              {paper.positions.length}{' '}
              <small>{paper.positions.slice(0, 2).map((position) => position.symbol.replace('USDT', '')).join(' · ')}</small>
            </div>
          </div>
          <div>
            <div className="k">Open orders</div>
            <div className="v">
              {paper.openOrders.length} <small>{paper.openOrders.some((order) => order.type === 'limit') ? 'limit' : ''}</small>
            </div>
          </div>
        </div>
        <div className="acct-links">
          <button type="button" className="ghost" onClick={onOpenPortfolio}>
            Portfolio
          </button>
          <button type="button" className="ghost" onClick={onOpenActivity}>
            Deposit / withdraw
          </button>
        </div>
      </section>
    </section>
  )
}
