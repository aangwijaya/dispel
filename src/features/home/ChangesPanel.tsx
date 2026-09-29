import type { CSSProperties } from 'react'
import { regimeAt } from '../../lib/read/demo'
import type { MarketRead, SinceRow } from '../../types/read'

interface ChangesPanelProps {
  read: MarketRead
  firstLaunch: boolean
}

const GLYPH: Record<SinceRow['kind'], { mark: string; color: string }> = {
  chg: { mark: '→', color: '#e6e6e6' },
  same: { mark: '=', color: '#6a6b6c' },
  new: { mark: '+', color: '#59d499' },
  end: { mark: '−', color: '#6a6b6c' },
}

export function ChangesPanel({ read, firstLaunch }: ChangesPanelProps) {
  const shiftColor = read.shift ? regimeAt(read.shift.to).color : '#9c9c9d'

  return (
    <section className="panel" aria-label="Changes">
      <div className="p-head">
        <div>
          <h3>
            Changes <span className="count">{read.changes.length} today</span>
          </h3>
          <p>What moved, and what deserves caution.</p>
        </div>
      </div>

      {firstLaunch ? (
        <div className="orient-box">
          <b>Dispel checks {read.coverage} every 15 minutes</b> for level tests, momentum turns, volume spikes
          and unusual volatility. When something changes it shows up here. None of it requires action.
        </div>
      ) : (
        <div className="since">
          <div className="since-h">
            <span className="eyebrow">Since your last visit</span>
            <span className="mono">11:20 · 3h 12m ago</span>
          </div>
          <ul>
            {read.since.map((row) => {
              const glyph = GLYPH[row.kind]
              return (
                <li key={`${row.label}-${row.text}`} className={row.kind === 'same' ? 'same' : undefined}>
                  <span className="g" style={{ color: glyph.color }}>
                    {glyph.mark}
                  </span>
                  <span className="l">{row.label}</span>
                  <span className="x">{row.text}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <ul className="events enter" key={read.stance}>
        {read.changes.map((event, index) => (
          <li
            key={`${event.time}-${event.subject}-${event.text}`}
            className={event.kind === 'shift' ? 'shiftrow' : undefined}
            style={{ '--i': index, '--seg': shiftColor } as CSSProperties}
          >
            <span className="mono">{event.time}</span>
            <span className={`gl ${event.kind === 'info' ? '' : event.kind}`} role="img" aria-label={event.kind} />
            <span className="sym">{event.subject}</span>
            <span className="txt">
              {event.text}
              <small>{event.detail}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
