import type { Setup } from '../../types/read'
import { sealSvg } from '../../lib/sigil'

interface SetupStripProps {
  setup: Setup
  onHide: () => void
}

export function SetupStrip({ setup, onHide }: SetupStripProps) {
  const odds = setup.odds
  return (
    <div className="ctx">
      <span className="lead">
        <span
          className="seal"
          title={odds === null ? 'Setup read' : `Setup read · ${odds}% odds`}
          dangerouslySetInnerHTML={{ __html: sealSvg('#ff6363', odds ?? 0) }}
        />
        <span className="eyebrow" style={{ color: '#ff9b9b' }}>
          Setup
        </span>
      </span>
      <span className="ctx-sum">
        <b className={setup.tone === 'neutral' ? 'ash' : setup.tone}>{setup.bias}</b> · {setup.summary}
      </span>
      <span className="sep" />
      <span>
        Invalid below <b>{setup.invalidation.value}</b>
      </span>
      <span className="sep" />
      <span>
        Target <b>{setup.target.value}</b>
      </span>
      <span className="sep" />
      <span className="mono">{setup.horizon}</span>
      <button type="button" className="hide end" onClick={onHide}>
        Hide
      </button>
    </div>
  )
}
