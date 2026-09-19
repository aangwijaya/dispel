export const DASH = '—'

export function formatPrice(value: string | null | undefined, precision: number): string {
  if (value === null || value === undefined) return DASH
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DASH
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })
}

export function formatQuantity(value: string | null | undefined, precision: number): string {
  if (value === null || value === undefined) return DASH
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DASH
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  })
}

export function formatCompact(value: string | null | undefined): string {
  if (value === null || value === undefined) return DASH
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DASH
  return numeric.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })
}

export function formatPercent(value: string | null | undefined): string {
  if (value === null || value === undefined) return DASH
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DASH
  const sign = numeric > 0 ? '+' : ''
  return `${sign}${numeric.toFixed(2)}%`
}

export function formatSigned(value: string | null | undefined, precision: number): string {
  if (value === null || value === undefined) return DASH
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DASH
  const sign = numeric > 0 ? '+' : ''
  return `${sign}${numeric.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}`
}

export function formatTime(time: number): string {
  if (!Number.isFinite(time)) return DASH
  return new Date(time).toLocaleTimeString('en-GB', { hour12: false })
}

export function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined) return DASH
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return DASH
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
