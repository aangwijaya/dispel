import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { BIAS_LABEL, TONE_COLOR, oddsTexture } from '../../lib/read/demo'
import type { Exposure, MarketRead, Setup } from '../../types/read'
import { LevelChart } from './LevelChart'
import { Pct } from './Pct'

const RISK_COLOR = ['#9c9c9d', '#e8b04a', '#f0506e']

interface SetupsPanelProps {
  read: MarketRead
  selected: number
  onSelect: (index: number) => void
  onOpenChart: (symbol: string) => void
  onToggleWatch: (symbol: string) => void
  onReviewPortfolio: () => void
}

export function SetupsPanel({
  read,
  selected,
  onSelect,
  onOpenChart,
  onToggleWatch,
  onReviewPortfolio,
}: SetupsPanelProps) {
  const isExposure = read.exposure.length > 0
  const forming = !isExposure && read.setups.length === 0
  const items: Exposure[] | Setup[] = isExposure
    ? read.exposure
    : read.setups.length > 0
      ? read.setups
      : read.forming

  const countLabel = isExposure
    ? `${read.exposure.length} positions`
    : forming
      ? `0 ready · ${read.forming.length} forming`
      : `${read.setups.length}`

  const current = items[selected] ?? items[0]

  function handleListKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (items.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = (selected + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      onSelect(next)
    } else if (event.key === 'Enter' && current) {
      event.preventDefault()
      onOpenChart(current.symbol)
    }
  }

  return (
    <section className="panel" aria-label={isExposure ? 'Exposure check' : 'Setups'}>
      <div className="p-head">
        <div>
          <h3>
            {isExposure ? 'Exposure check' : 'Setups'} <span className="count">{countLabel}</span>
          </h3>
          <p>
            {isExposure
              ? 'Risk-off market. Your open positions, checked against their levels.'
              : 'Worth investigating, not instructions to buy. Ordered by time horizon, not by score.'}
          </p>
        </div>
      </div>

      <div className="setups-body">
        <div>
          <div
            className="list"
            role="listbox"
            tabIndex={0}
            aria-label={isExposure ? 'Positions' : 'Setups'}
            onKeyDown={handleListKeys}
          >
            {isExposure ? (
              <div className="protect">
                <b>Protect first</b>
                <p>
                  No new setups in a risk-off market. Below are your open positions checked against their
                  levels. Dispel doesn't sell for you: this is a check, not an instruction.
                </p>
              </div>
            ) : null}

            {forming ? (
              <>
                <div className="empty">
                  <b>No setup worth chasing</b>
                  <p>Nothing meets the bar in this market. These two are closest to forming.</p>
                </div>
                <div className="sublabel eyebrow">Closest to forming</div>
              </>
            ) : null}

            {items.map((item, index) => {
              const color = TONE_COLOR[item.tone]
              const selectedRow = index === selected
              if ('status' in item) {
                const bar =
                  item.cushionPct === null ? (
                    <i className="broken" style={{ width: '100%', '--c': color } as CSSProperties} />
                  ) : (
                    <i
                      style={{
                        width: `${Math.min((item.cushionPct / 5) * 100, 100)}%`,
                        '--c': color,
                      } as CSSProperties}
                    />
                  )
                return (
                  <button
                    key={item.symbol}
                    type="button"
                    className="item"
                    role="option"
                    aria-selected={selectedRow}
                    onClick={() => onSelect(index)}
                    style={{ '--bc': color } as CSSProperties}
                  >
                    <span className="ico">{item.monogram}</span>
                    <span className="t1">
                      <b>{item.symbol}</b>
                      <span style={{ color }}>{item.status}</span>
                    </span>
                    <div className="odds">
                      <b className={`pl num ${item.plPct >= 0 ? 'up' : 'down'}`}>
                        {item.plPct > 0 ? '+' : ''}
                        {item.plPct.toFixed(2)}%
                      </b>
                      <div className="obar">{bar}</div>
                    </div>
                    <span className="t2">{item.summary}</span>
                    <span className="t3">
                      <span>{item.holding}</span>
                      <i>·</i>
                      <span>entry {item.entry}</span>
                      <i>·</i>
                      <span style={{ color }}>level {item.invalidation.value}</span>
                    </span>
                  </button>
                )
              }

              const odds =
                item.odds === null ? (
                  <div className="odds">
                    <b className="smoke" style={{ fontSize: '12px' }}>
                      {forming ? 'Not yet' : 'If / then'}
                    </b>
                    <div className="obar">
                      <i style={{ width: 0 }} />
                    </div>
                  </div>
                ) : (
                  <div className="odds">
                    <b className="num">{item.odds}</b>
                    <small>%</small>
                    <div className="obar">
                      <i
                        className={oddsTexture(item.confidence)}
                        style={{ width: `${item.odds}%`, '--c': color } as CSSProperties}
                      />
                    </div>
                  </div>
                )

              return (
                <button
                  key={item.symbol}
                  type="button"
                  className={`item ${forming ? 'forming' : ''}`}
                  role="option"
                  aria-selected={selectedRow}
                  onClick={() => onSelect(index)}
                  style={{ '--bc': color } as CSSProperties}
                >
                  <span className="ico">{item.monogram}</span>
                  <span className="t1">
                    <b>{item.symbol}</b>
                    <span className={item.tone === 'neutral' ? 'ash' : item.tone}>{item.bias}</span>
                    {item.isNew ? <span className="newb">new</span> : null}
                  </span>
                  {odds}
                  <span className="t2">{item.summary}</span>
                  <span className="t3">
                    {forming && item.condition ? (
                      <span>{item.condition}</span>
                    ) : (
                      <>
                        <span>{BIAS_LABEL[item.confidence]} confidence</span>
                        <i>·</i>
                        <span style={{ color: RISK_COLOR[item.risk] }}>{BIAS_LABEL[item.risk]} risk</span>
                        <i>·</i>
                        <span>{item.horizon}</span>
                      </>
                    )}
                  </span>
                </button>
              )
            })}

            {isExposure ? (
              <div className="sublabel smoke" style={{ fontSize: '12px' }}>
                Nothing else you hold is exposed to a broken level.
              </div>
            ) : null}
          </div>

          <div className="howto" hidden={forming}>
            {isExposure ? (
              <>
                <div>
                  <div className="obar">
                    <i style={{ width: '30%', '--c': '#e8b04a' } as CSSProperties} />
                  </div>
                  <span>
                    <b>Bar</b> shows the cushion left above the invalidation level. A full bar is 5% or more.
                  </span>
                </div>
                <div>
                  <div className="obar">
                    <i className="broken" style={{ width: '100%', '--c': '#f0506e' } as CSSProperties} />
                  </div>
                  <span>
                    <b>Striped red</b> means the level has already broken.
                  </span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="obar">
                    <i style={{ width: '80%', '--c': '#e6e6e6' } as CSSProperties} />
                  </div>
                  <span>
                    <b>Bar length</b> is the odds of reaching the target before the invalidation level.
                  </span>
                </div>
                <div>
                  <div className="obar">
                    <i className="thin" style={{ width: '80%', '--c': '#e6e6e6' } as CSSProperties} />
                  </div>
                  <span>
                    <b>Hatched</b> means the evidence is thin. A solid bar means strong agreement.
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="detail" style={{ '--bc': current ? TONE_COLOR[current.tone] : '#9c9c9d' } as CSSProperties}>
          {!current ? null : 'status' in current ? (
            <ExposureDetail item={current} onOpenChart={onOpenChart} onReviewPortfolio={onReviewPortfolio} />
          ) : (
            <SetupDetail
              item={current}
              forming={forming}
              onOpenChart={onOpenChart}
              onToggleWatch={onToggleWatch}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function DetailHead({
  monogram,
  symbol,
  label,
  tone,
  price,
  changePct,
}: {
  monogram: string
  symbol: string
  label: string
  tone: Exposure['tone']
  price: string
  changePct: number
}) {
  return (
    <div className="d-head">
      <span className="ico">{monogram}</span>
      <div>
        <b>{symbol}</b>
        <div style={{ fontSize: '12px', fontWeight: 500, color: TONE_COLOR[tone] }}>{label}</div>
      </div>
      <div className="px">
        <div>{price}</div>
        <Pct value={changePct} />
      </div>
    </div>
  )
}

function SetupDetail({
  item,
  forming,
  onOpenChart,
  onToggleWatch,
}: {
  item: Setup
  forming: boolean
  onOpenChart: (symbol: string) => void
  onToggleWatch: (symbol: string) => void
}) {
  if (forming) {
    return (
      <>
        <DetailHead
          monogram={item.monogram}
          symbol={item.symbol}
          label={item.bias}
          tone={item.tone}
          price={item.price}
          changePct={item.changePct}
        />
        <p className="d-setup">{item.summary}</p>
        <div className="empty" style={{ margin: 0 }}>
          <span className="eyebrow">What would need to happen</span>
          <p style={{ color: '#e6e6e6', fontSize: '14px', marginTop: '6px' }}>{item.condition}</p>
        </div>
        <div className="chart">
          <LevelChart
            anchors={item.anchors}
            seed={item.seed}
            tone={item.tone}
            invalidation={item.invalidation}
            target={item.target}
            label={item.symbol}
          />
        </div>
        <div className="d-actions">
          <button type="button" className="btn" onClick={() => onOpenChart(item.symbol)}>
            Open chart <kbd>↵</kbd>
          </button>
          <span className="note">You will see it in Changes.</span>
        </div>
      </>
    )
  }

  const dims: Array<[string, string]> = [
    ['Odds', item.odds === null ? 'Conditional' : `${item.odds}%`],
    ['Confidence', BIAS_LABEL[item.confidence]],
    ['Risk', BIAS_LABEL[item.risk]],
    ['Horizon', item.horizon],
  ]

  return (
    <>
      <DetailHead
        monogram={item.monogram}
        symbol={item.symbol}
        label={item.bias}
        tone={item.tone}
        price={item.price}
        changePct={item.changePct}
      />
      <p className="d-setup">{item.summary}</p>
      <div className="d-dims">
        {dims.map(([key, value]) => (
          <div key={key}>
            <div className="k">{key}</div>
            <div className="v">{value}</div>
          </div>
        ))}
      </div>
      <div className="chart">
        <LevelChart
          anchors={item.anchors}
          seed={item.seed}
          tone={item.tone}
          invalidation={item.invalidation}
          target={item.target}
          label={item.symbol}
        />
      </div>
      <div className="d-cols">
        <div>
          <h4 className="eyebrow">What we see</h4>
          <ul>
            {item.sees.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="lv">
          <h4 className="eyebrow" style={{ margin: 0 }}>
            Levels
          </h4>
          <div>
            <b className="down">{item.invalidation.value}</b>
            Invalid if {item.invalidation.note}
          </div>
          <div>
            <b className="white">{item.target.value}</b>
            Target: {item.target.note}
          </div>
        </div>
      </div>
      <div className="d-actions">
        <button type="button" className="btn" onClick={() => onOpenChart(item.symbol)}>
          Open chart <kbd>↵</kbd>
        </button>
        <button type="button" className="btn2" onClick={() => onToggleWatch(item.symbol)}>
          Add to watchlist
        </button>
        <span className="note">Paper funds only</span>
      </div>
    </>
  )
}

function ExposureDetail({
  item,
  onOpenChart,
  onReviewPortfolio,
}: {
  item: Exposure
  onOpenChart: (symbol: string) => void
  onReviewPortfolio: () => void
}) {
  const dims: Array<[string, ReactNode]> = [
    ['Holding', item.holding],
    ['Entry', item.entry],
    ['Now', item.price],
    ['P/L', <Pct key="pl" value={item.plPct} />],
  ]

  return (
    <>
      <DetailHead
        monogram={item.monogram}
        symbol={item.symbol}
        label={item.status}
        tone={item.tone}
        price={item.price}
        changePct={item.changePct}
      />
      <p className="d-setup">{item.summary}</p>
      <div className="d-dims">
        {dims.map(([key, value]) => (
          <div key={key}>
            <div className="k">{key}</div>
            <div className="v">{value}</div>
          </div>
        ))}
      </div>
      <div className="chart">
        <LevelChart
          anchors={item.anchors}
          seed={item.seed}
          tone={item.tone}
          invalidation={item.invalidation}
          target={item.target}
          label={item.symbol}
        />
      </div>
      <div className="d-cols">
        <div>
          <h4 className="eyebrow">What we see</h4>
          <ul>
            {item.sees.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="lv">
          <h4 className="eyebrow" style={{ margin: 0 }}>
            Levels
          </h4>
          <div>
            <b className="down">{item.invalidation.value}</b>
            {item.cushionPct === null ? item.invalidation.note : `Invalid on ${item.invalidation.note}`}
          </div>
          <div>
            <b className="white">{item.target.value}</b>
            {item.target.note}
          </div>
        </div>
      </div>
      <div className="d-actions">
        <button type="button" className="btn" onClick={() => onOpenChart(item.symbol)}>
          Open chart <kbd>↵</kbd>
        </button>
        <button type="button" className="btn2" onClick={onReviewPortfolio}>
          Review in Portfolio
        </button>
        <span className="note">A check, not an instruction.</span>
      </div>
    </>
  )
}
