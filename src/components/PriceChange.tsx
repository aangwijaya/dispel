import { formatPercent } from '../lib/market/format'

interface PriceChangeProps {
  value: string | null | undefined
  className?: string
}

export function PriceChange({ value, className }: PriceChangeProps) {
  const numeric = value === null || value === undefined ? Number.NaN : Number(value)

  if (!Number.isFinite(numeric)) {
    return <span className={`tabular-nums text-smoke ${className ?? ''}`}>—</span>
  }

  const tone = numeric > 0 ? 'text-up' : numeric < 0 ? 'text-down' : 'text-smoke'
  return <span className={`tabular-nums ${tone} ${className ?? ''}`}>{formatPercent(value)}</span>
}
