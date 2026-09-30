import { useEffect, useId, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { rng } from '../../lib/read/demo'

export type EquityRange = '24' | '72' | 'all'

interface EquityChartProps {
  equity: number
  netDeposited: number
  range: EquityRange
}

const START = Date.UTC(2026, 8, 20, 9)
const HOURS = 7 * 24 + 5
const MOVES = [
  { at: 0, value: 10000 },
  { at: 3 * 24 + 4, value: 500 },
  { at: 6 * 24 + 1, value: -300 },
  { at: 6 * 24 + 10, value: -145.98 },
  { at: 7 * 24, value: 247.6 },
]
const DEMO_DEPOSITED = MOVES.reduce((total, move) => total + move.value, 0)

function formatAxis(value: number): string {
  if (Math.abs(value) < 0.5) return '0'
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString('en-US')
  return value.toFixed(0)
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function EquityChart({ equity, netDeposited, range }: EquityChartProps) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hover, setHover] = useState<number | null>(null)
  const gradientId = useId()
  const aboveId = `${gradientId}-above`
  const belowId = `${gradientId}-below`
  const clipAbove = `${gradientId}-ca`
  const clipBelow = `${gradientId}-cb`

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const update = () => setSize({ width: box.clientWidth, height: box.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  const series = useMemo(() => {
    const random = rng(77)
    const scale = DEMO_DEPOSITED === 0 ? 0 : netDeposited / DEMO_DEPOSITED
    const target = equity - netDeposited
    const energy = Math.abs(target) < 1 ? 0 : 1
    let pnl = 0
    const equityPoints: number[] = []
    const basePoints: number[] = []
    for (let hour = 0; hour <= HOURS; hour++) {
      const base = MOVES.filter((move) => move.at <= hour).reduce((total, move) => total + move.value, 0) * scale
      const t = hour / HOURS
      const shape =
        target * (0.55 * t + 0.45 * Math.sin(t * Math.PI * 1.15) * t) -
        120 * Math.sin(t * Math.PI * 2.2) * (1 - t) * 0.6 * energy
      pnl = pnl * 0.82 + (random() - 0.5) * 38 * energy
      basePoints.push(base)
      equityPoints.push(hour === HOURS ? equity : base + shape + pnl)
    }
    return {
      equity: equityPoints,
      base: basePoints,
      moves: MOVES.map((move) => ({ at: move.at, value: move.value * scale })),
    }
  }, [equity, netDeposited])

  const total = series.equity.length
  const count = range === 'all' ? total : Math.min(Number(range) + 1, total)
  const offset = total - count
  const equitySlice = series.equity.slice(-count)
  const baseSlice = series.base.slice(-count)

  const width = Math.max(size.width, 300)
  const height = Math.max(size.height, 180)
  const padLeft = 24
  const padRight = 72
  const padTop = 28
  const padBottom = 26
  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  const lo0 = Math.min(...equitySlice, ...baseSlice)
  const hi0 = Math.max(...equitySlice, ...baseSlice)
  const pad = (hi0 - lo0) * 0.12 || 1
  const lo = lo0 - pad
  const hi = hi0 + pad

  const x = (index: number) => padLeft + (index / Math.max(count - 1, 1)) * plotWidth
  const y = (value: number) => padTop + plotHeight * (1 - (value - lo) / (hi - lo))

  const equityPoints = equitySlice.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`)
  const basePoints = baseSlice.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`)
  const band = `M${equityPoints.join(' L')} L${basePoints.slice().reverse().join(' L')} Z`
  const above = `M${padLeft},${padTop - 40} L${basePoints.join(' L')} L${padLeft + plotWidth},${padTop - 40} Z`
  const below = `M${padLeft},${height} L${basePoints.join(' L')} L${padLeft + plotWidth},${height} Z`

  const lastEquity = equitySlice[count - 1] ?? equity
  const lastBase = baseSlice[count - 1] ?? netDeposited
  const tagYs = [y(lastEquity), y(lastBase)].concat(hover !== null ? [y(equitySlice[hover] ?? lastEquity)] : [])

  const grid = [0, 1, 2, 3].map((k) => {
    const value = lo + ((hi - lo) * (k + 0.5)) / 4
    const gridY = y(value)
    const clash = tagYs.some((tagY) => Math.abs(tagY - gridY) < 14)
    return { value, gridY, clash }
  })

  const labelStep =
    plotWidth < 400 ? Math.max(Math.ceil(count / 4), 1) : count <= 25 ? 6 : count <= 73 ? 12 : 24
  const xLabels: Array<{ index: number; text: string }> = []
  for (let index = 0; index < count; index += labelStep) {
    const date = new Date(START + (offset + index) * 3_600_000)
    const text =
      count <= 25
        ? `${String(date.getUTCHours()).padStart(2, '0')}:00`
        : `Sep ${date.getUTCDate()}`
    xLabels.push({ index, text })
  }

  const visibleMoves = series.moves.filter((move) => move.at > offset && move.at <= offset + count - 1)

  function handleMove(event: ReactMouseEvent<HTMLDivElement>) {
    const box = boxRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    const index = Math.round(((event.clientX - rect.left - padLeft) / plotWidth) * (count - 1))
    setHover(index >= 0 && index < count ? index : null)
  }

  const readIndex = hover ?? count - 1
  const readDate = new Date(START + (offset + readIndex) * 3_600_000)
  const readGain = (equitySlice[readIndex] ?? lastEquity) - (baseSlice[readIndex] ?? lastBase)

  return (
    <div
      className="eq-chart"
      ref={boxRef}
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(null)}
    >
      <div className="eq-read">
        <span>
          {hover === null
            ? 'Now'
            : `Sep ${readDate.getUTCDate()} · ${String(readDate.getUTCHours()).padStart(2, '0')}:00`}
        </span>
        <span>
          Equity<b>{formatMoney(equitySlice[readIndex] ?? lastEquity)}</b>
        </span>
        <span>
          Deposited<b>{formatMoney(baseSlice[readIndex] ?? lastBase)}</b>
        </span>
        <span>
          {readGain >= 0 ? 'Ahead' : 'Behind'}
          <b className={readGain >= 0 ? 'up' : 'down'}>
            {readGain >= 0 ? '+' : '−'}
            {formatMoney(Math.abs(readGain))}
          </b>
        </span>
      </div>

      {size.width > 0 ? (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Equity against net deposited over the selected range (history is demo design data)"
        >
          <defs>
            <clipPath id={clipAbove}>
              <path d={above} />
            </clipPath>
            <clipPath id={clipBelow}>
              <path d={below} />
            </clipPath>
            <linearGradient id={aboveId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#59d499" stopOpacity=".32" />
              <stop offset="1" stopColor="#59d499" stopOpacity=".06" />
            </linearGradient>
            <linearGradient id={belowId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f0506e" stopOpacity=".08" />
              <stop offset="1" stopColor="#f0506e" stopOpacity=".3" />
            </linearGradient>
          </defs>

          {grid.map((line) => (
            <g key={line.value}>
              <line
                x1={padLeft}
                x2={padLeft + plotWidth}
                y1={line.gridY.toFixed(1)}
                y2={line.gridY.toFixed(1)}
                stroke="rgba(255,255,255,.04)"
              />
              {line.clash ? null : (
                <text
                  x={padLeft + plotWidth + 10}
                  y={(line.gridY + 3.5).toFixed(1)}
                  fill="#6a6b6c"
                  fontSize="10"
                  fontFamily="Geist Mono Variable, monospace"
                >
                  {formatAxis(line.value)}
                </text>
              )}
            </g>
          ))}

          {xLabels.map((label) => (
            <text
              key={label.index}
              x={x(label.index).toFixed(1)}
              y={height - 8}
              fill="#6a6b6c"
              fontSize="10"
              fontFamily="Geist Mono Variable, monospace"
              textAnchor={label.index === 0 ? 'start' : 'middle'}
            >
              {label.text}
            </text>
          ))}

          <path d={band} fill={`url(#${aboveId})`} clipPath={`url(#${clipAbove})`} />
          <path d={band} fill={`url(#${belowId})`} clipPath={`url(#${clipBelow})`} />

          <polyline
            points={basePoints.join(' ')}
            fill="none"
            stroke="rgba(255,255,255,.5)"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />

          {visibleMoves.map((move) => {
            const index = move.at - offset
            return (
              <g key={move.at}>
                <line
                  x1={x(index).toFixed(1)}
                  x2={x(index).toFixed(1)}
                  y1={padTop}
                  y2={padTop + plotHeight}
                  stroke="rgba(255,255,255,.07)"
                />
                <circle
                  cx={x(index).toFixed(1)}
                  cy={y(baseSlice[index] ?? lastBase).toFixed(1)}
                  r="3.5"
                  fill="#07080a"
                  stroke="#9c9c9d"
                  strokeWidth="1.2"
                >
                  <title>{`${move.value > 0 ? 'Deposit' : 'Withdrawal'} ${formatMoney(Math.abs(move.value))} USDT`}</title>
                </circle>
              </g>
            )
          })}

          <polyline
            points={equityPoints.join(' ')}
            fill="none"
            stroke="#59d499"
            strokeWidth="5"
            opacity=".35"
          />
          <polyline
            points={equityPoints.join(' ')}
            fill="none"
            stroke="#59d499"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />

          <circle cx={x(count - 1).toFixed(1)} cy={y(lastEquity).toFixed(1)} r="9" fill="#59d499" opacity=".18">
            <animate attributeName="r" values="5;12;5" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values=".35;0;.35" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle
            cx={x(count - 1).toFixed(1)}
            cy={y(lastEquity).toFixed(1)}
            r="7"
            fill="none"
            stroke="rgba(255,255,255,.4)"
            strokeWidth="1"
          />
          <circle cx={x(count - 1).toFixed(1)} cy={y(lastEquity).toFixed(1)} r="3.5" fill="#fff" />

          <rect x={padLeft + plotWidth + 4} y={(y(lastEquity) - 9).toFixed(1)} width={padRight - 8} height="18" rx="5" fill="#e6e6e6" />
          <text
            x={padLeft + plotWidth + 10}
            y={(y(lastEquity) + 3.5).toFixed(1)}
            fill="#454647"
            fontSize="10"
            fontWeight="500"
            fontFamily="Geist Mono Variable, monospace"
          >
            {formatAxis(lastEquity)}
          </text>
          <rect x={padLeft + plotWidth + 4} y={(y(lastBase) - 9).toFixed(1)} width={padRight - 8} height="18" rx="5" fill="#1b1c1e" />
          <text
            x={padLeft + plotWidth + 10}
            y={(y(lastBase) + 3.5).toFixed(1)}
            fill="#9c9c9d"
            fontSize="10"
            fontWeight="500"
            fontFamily="Geist Mono Variable, monospace"
          >
            {formatAxis(lastBase)}
          </text>

          {hover !== null ? (
            <g>
              <line
                x1={x(hover).toFixed(1)}
                x2={x(hover).toFixed(1)}
                y1={padTop}
                y2={padTop + plotHeight}
                stroke="rgba(255,255,255,.22)"
                strokeDasharray="3 3"
              />
              <circle
                cx={x(hover).toFixed(1)}
                cy={y(equitySlice[hover] ?? lastEquity).toFixed(1)}
                r="4"
                fill="#59d499"
                stroke="#07080a"
                strokeWidth="2"
              />
              <rect x={padLeft + plotWidth + 4} y={(y(equitySlice[hover] ?? lastEquity) - 9).toFixed(1)} width={padRight - 8} height="18" rx="5" fill="#2f3031" />
              <text
                x={padLeft + plotWidth + 10}
                y={(y(equitySlice[hover] ?? lastEquity) + 3.5).toFixed(1)}
                fill="#ffffff"
                fontSize="10"
                fontWeight="500"
                fontFamily="Geist Mono Variable, monospace"
              >
                {formatAxis(equitySlice[hover] ?? lastEquity)}
              </text>
            </g>
          ) : null}
        </svg>
      ) : null}
    </div>
  )
}
