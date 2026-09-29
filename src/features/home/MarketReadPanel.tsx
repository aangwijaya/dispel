import type { CSSProperties } from 'react'
import {
  AURA_ART,
  BIAS_LABEL,
  REGIMES,
  STANCE_COLOR,
  VERDICT_TINT,
  VOLATILITY_LABEL,
  regimeAt,
} from '../../lib/read/demo'
import type { MarketRead, Stance, Tone } from '../../types/read'

const TONE_CLASS: Record<Tone, string> = {
  up: 'up',
  down: 'down',
  caution: 'caution',
  neutral: 'ash',
}

const RISK_COLOR = ['#9c9c9d', '#e8b04a', '#f0506e']
const NOW = 14.53

interface MarketReadPanelProps {
  read: MarketRead
  firstLaunch: boolean
  stale: boolean
  staleMinutes: number
  whyOpen: boolean
  onToggleWhy: () => void
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1.5 15 14H1L8 1.5Zm-.75 4.5v4h1.5V6h-1.5Zm0 5.2v1.5h1.5v-1.5h-1.5Z" />
    </svg>
  )
}

export function MarketReadPanel({ read, firstLaunch, stale, staleMinutes, whyOpen, onToggleWhy }: MarketReadPanelProps) {
  const style = {
    '--stance': STANCE_COLOR[read.stance],
    '--vtint': VERDICT_TINT[read.stance],
  } as CSSProperties

  const regime = regimeAt(read.regimeIndex)

  return (
    <section className="panel read-panel" id="read" aria-label="Market read" data-stance={read.stance} style={style}>
      <div className="aura" aria-hidden="true">
        {(Object.keys(AURA_ART) as Stance[]).map((stance) => (
          <img
            key={stance}
            data-s={stance}
            src={AURA_ART[stance]}
            className={stance === read.stance ? 'on' : undefined}
            alt=""
          />
        ))}
      </div>

      <div className="read-grid">
        <section>
          <div className="read-meta">
            <span className="sdot" aria-hidden="true" />
            <span className="eyebrow">Market read</span>
            <span className={`mono ${stale ? 'caution' : ''}`}>
              {stale ? `last read ${staleMinutes}m ago · ${read.coverage}` : `${read.time} · ${read.coverage}`}
            </span>
          </div>
          <h2 key={read.stance} className={`verdict enter ${stale ? 'stale' : ''}`}>
            {read.verdict}
          </h2>
          <p className="stance">
            <b className={TONE_CLASS[read.biasTone]}>{read.bias}</b> bias · {read.biasLine}
          </p>
          <p className="explain">
            <strong>{read.explainLead}</strong> {read.explainRest}
          </p>
          <div className="well">
            <WarningIcon />
            <span>{read.caution}</span>
          </div>
        </section>

        <section>
          <div className="today-h">
            <span className="eyebrow">Market regime</span>
            <span className="mono smoke">risk scale</span>
          </div>
          <div className="regime-now">
            <b>{regime.name}</b>
            <span className="mono smoke">step {read.regimeIndex + 1} of 5</span>
          </div>
          <div className="scale">
            {REGIMES.map((item, index) => (
              <div key={item.name} className={index === read.regimeIndex ? 'on' : undefined} style={{ '--seg': item.color } as CSSProperties}>
                <i />
                <span>{item.name}</span>
              </div>
            ))}
          </div>
          <div className="today-h ribbon-l">
            <span className="eyebrow">Today</span>
            <span className="mono smoke">UTC</span>
          </div>
          <div className="ribbon">
            {read.ribbon.map((segment) => {
              const item = regimeAt(segment.regime)
              const width = segment.to - segment.from
              return (
                <b
                  key={`${segment.from}-${segment.regime}`}
                  style={{ flex: `${width.toFixed(2)} 1 0`, '--seg': item.color } as CSSProperties}
                  title={item.name}
                >
                  {width > 2.4 ? item.name : ''}
                </b>
              )
            })}
          </div>
          <div className="ticks">
            {['00:00', '04:00', '08:00', '12:00'].map((tick, index) => (
              <span key={tick} style={{ left: `${((index * 4) / NOW) * 100}%` }}>
                {tick}
              </span>
            ))}
            <span style={{ left: '100%' }}>Now</span>
          </div>
          <div className="shift">
            {read.shift ? (
              <>
                <span className="mono">{read.shift.time}</span>
                <strong>
                  Shift: {regimeAt(read.shift.from).name} → {regimeAt(read.shift.to).name}
                </strong>
                <p>{read.shift.why}</p>
              </>
            ) : (
              <>
                <span className="mono">26h</span>
                <strong>No regime change today</strong>
                <p>A shift will be marked here the moment conditions change.</p>
              </>
            )}
          </div>
        </section>
      </div>

      <div className="stats">
        <div>
          <div className="k">Trend strength</div>
          <div className="v num">
            {read.stats.strength} <small>/ 100</small>
          </div>
          <div className="meter mid">
            <i style={{ width: `${read.stats.strength}%` }} />
          </div>
          {firstLaunch ? (
            <div className="hint">How firmly one side controls price. 50 means neither side does.</div>
          ) : null}
        </div>
        <div>
          <div className="k">Confidence</div>
          <div className="v">{BIAS_LABEL[read.stats.confidence]}</div>
          <div className="steps3">
            {[0, 1, 2].map((step) => (
              <i key={step} className={step <= read.stats.confidence ? 'f' : undefined} />
            ))}
          </div>
          {firstLaunch ? <div className="hint">How much of the evidence agrees with this read.</div> : null}
        </div>
        <div>
          <div className="k">Risk</div>
          <div className="v" style={{ color: RISK_COLOR[read.stats.risk] === '#9c9c9d' ? '#fff' : RISK_COLOR[read.stats.risk] }}>
            {BIAS_LABEL[read.stats.risk]}
          </div>
          <div className="steps3" style={{ '--fill': RISK_COLOR[read.stats.risk] } as CSSProperties}>
            {[0, 1, 2].map((step) => (
              <i key={step} className={step <= read.stats.risk ? 'f' : undefined} />
            ))}
          </div>
          {firstLaunch ? <div className="hint">How costly being wrong could be right now.</div> : null}
        </div>
        <div>
          <div className="k">Volatility</div>
          <div className="v" style={{ color: read.stats.volatility >= 2 ? '#e8b04a' : '#fff' }}>
            {VOLATILITY_LABEL[read.stats.volatility]}
          </div>
          <div
            className="steps4"
            style={{ '--fill': read.stats.volatility >= 2 ? '#e8b04a' : '#e6e6e6' } as CSSProperties}
          >
            {VOLATILITY_LABEL.map((_, index) => (
              <i key={index} className={index === read.stats.volatility ? 'f' : undefined} />
            ))}
          </div>
          {firstLaunch ? <div className="hint">Size of price swings compared with the past month.</div> : null}
        </div>
      </div>

      <div className="why-bar">
        <button type="button" className="why-btn" aria-expanded={whyOpen} aria-controls="why" onClick={onToggleWhy}>
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
          </svg>
          Why this read <kbd>E</kbd>
        </button>
        <span className="mono">Trend · Momentum · Volume · Volatility · Breadth · Levels · Positioning · On-chain</span>
      </div>
      <div className="why" id="why" hidden={!whyOpen}>
        {read.evidence.map((item) => (
          <div key={item.label}>
            <div className="k">{item.label}</div>
            <div className={`v ${TONE_CLASS[item.tone]}`}>{item.state}</div>
            <div className="d">{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
