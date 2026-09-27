import { useId } from 'react'
import { series } from '../../lib/read/demo'
import type { Level, Tone } from '../../types/read'

interface LevelChartProps {
  anchors: number[]
  seed: number
  tone: Tone
  invalidation?: Level
  target?: Level
  label: string
}

const TONE_FILL: Record<Tone, string> = {
  up: '#59d499',
  down: '#f0506e',
  caution: '#e8b04a',
  neutral: '#9c9c9d',
}

function formatAxis(value: number): string {
  if (value >= 1000) return Math.round(value).toLocaleString('en-US')
  if (value >= 100) return value.toFixed(1)
  return value.toFixed(2)
}

function parseLevel(level?: Level): number | null {
  if (!level) return null
  const value = Number.parseFloat(level.value.replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

export function LevelChart({ anchors, seed, tone, invalidation, target, label }: LevelChartProps) {
  const gradientId = useId()
  const values = series(anchors, seed)
  if (values.length < 2) return null

  const width = 360
  const height = 130
  const priceRight = 60
  const padTop = 8
  const padBottom = 10
  const chartWidth = width - priceRight

  const levels: Array<{ value: number; color: string }> = []
  const invalidationValue = parseLevel(invalidation)
  const targetValue = parseLevel(target)
  if (invalidationValue !== null) levels.push({ value: invalidationValue, color: '#f0506e' })
  if (targetValue !== null) levels.push({ value: targetValue, color: '#6a6b6c' })

  const all = [...values, ...levels.map((level) => level.value)]
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const pad = (hi - lo) * 0.07 || 1
  const y = (value: number) =>
    padTop + (height - padTop - padBottom) * (1 - (value - (lo - pad)) / (hi + pad - (lo - pad)))
  const sx = chartWidth / (values.length - 1)
  const points = values.map((value, index) => `${(index * sx).toFixed(1)},${y(value).toFixed(1)}`)
  const last = values[values.length - 1] ?? 0
  const fill = TONE_FILL[tone]
  const lastY = y(last)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} recent price with levels (demo design data)`}>
      {[0.25, 0.5, 0.75].map((fraction) => {
        const gridY = (padTop + (height - padTop - padBottom) * fraction).toFixed(1)
        return <line key={fraction} x1="0" x2={chartWidth} y1={gridY} y2={gridY} stroke="rgba(255,255,255,.04)" />
      })}
      <line x1="0" x2={chartWidth} y1={height - padBottom} y2={height - padBottom} stroke="#2f3031" />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={fill} stopOpacity=".22" />
          <stop offset="1" stopColor={fill} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M0,${height - padBottom} L${points.join(' L')} L${chartWidth},${height - padBottom} Z`} fill={`url(#${gradientId})`} />
      {levels.map((level) => (
        <g key={level.color}>
          <line
            x1="0"
            x2={chartWidth}
            y1={y(level.value).toFixed(1)}
            y2={y(level.value).toFixed(1)}
            stroke={level.color}
            strokeDasharray="3 3"
          />
          <text
            x={chartWidth + 8}
            y={(y(level.value) + 3.5).toFixed(1)}
            fontSize="10"
            fontFamily="Geist Mono Variable, monospace"
            fill={level.color}
          >
            {formatAxis(level.value)}
          </text>
        </g>
      ))}
      <polyline points={points.join(' ')} fill="none" stroke="#e6e6e6" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx={chartWidth} cy={lastY.toFixed(1)} r="7" fill={fill} opacity=".25" />
      <circle cx={chartWidth} cy={lastY.toFixed(1)} r="3" fill="#ffffff" />
      <text
        x={chartWidth + 8}
        y={(lastY + 3.5).toFixed(1)}
        fontSize="10"
        fontWeight="500"
        fontFamily="Geist Mono Variable, monospace"
        fill="#ffffff"
      >
        {formatAxis(last)}
      </text>
    </svg>
  )
}
