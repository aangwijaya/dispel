interface SparklineProps {
  values: number[]
  color: string
  stretch?: boolean
}

export function Sparkline({ values, color, stretch = false }: SparklineProps) {
  if (values.length < 2) return null

  const width = 60
  const height = 18
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const sx = width / (values.length - 1)
  const sy = (height - 4) / (hi - lo || 1)
  const points = values
    .map((value, index) => `${(index * sx).toFixed(1)},${(height - 2 - (value - lo) * sy).toFixed(1)}`)
    .join(' ')

  return (
    <svg
      className={stretch ? undefined : 'spark'}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={stretch ? 'none' : undefined}
      aria-hidden="true"
    >
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
