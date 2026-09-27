import type { Setup } from '../../types/read'

interface SetupStripProps {
  setup: Setup
  onHide: () => void
}

export function SetupStrip({ setup, onHide }: SetupStripProps) {
  return (
    <div className="ctx">
      <span className="eyebrow">Setup</span>
      <b className={setup.tone === 'neutral' ? 'ash' : setup.tone}>{setup.bias}</b>
      <span>{setup.summary}</span>
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
