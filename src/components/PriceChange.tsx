import { formatPercent } from '../lib/market/format'

interface PriceChangeProps {
  value: string | null | undefined
  className?: string
}

export function PriceChange({ value, className }: PriceChangeProps) {
  const numeric = value === null || value === undefined ? Number.NaN : Number(value)

  if (!Number.isFinite(numeric)) {
    return <span className={`tabular-nums text-faint ${className ?? ''}`}>—</span>
  }

  const tone = numeric > 0 ? 'text-buy' : numeric < 0 ? 'text-sell' : 'text-faint'
  return <span className={`tabular-nums ${tone} ${className ?? ''}`}>{formatPercent(value)}</span>
}
