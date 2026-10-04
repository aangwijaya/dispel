import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineWidth,
  type UTCTimestamp,
} from 'lightweight-charts'
import { fetchKlines } from '../../lib/market/binance'
import { ema, rsi, sma, type Series } from '../../lib/market/indicators'
import { subscribeKline } from '../../lib/market/stream'
import { TIMEFRAMES, type Candle, type Market, type Timeframe } from '../../types/market'
import type { Setup } from '../../types/read'

interface TradingChartProps {
  market: Market
  setup: Setup | null
}

const COLORS = {
  text: '#6a6b6c',
  grid: 'rgba(255,255,255,0.04)',
  up: '#59d499',
  down: '#f0506e',
  upVolume: 'rgba(89,212,153,0.28)',
  downVolume: 'rgba(240,80,110,0.28)',
  guide: 'rgba(156,156,157,0.55)',
  midline: 'rgba(156,156,157,0.14)',
}

// '1M' is Binance's month interval; show it so it cannot be mistaken for 1 minute.
const TIMEFRAME_LABELS: Partial<Record<Timeframe, string>> = { '1M': '1mo' }

type LineKey = 'ema20' | 'ema50' | 'ema200' | 'sma20'
type IndicatorKey = LineKey | 'rsi'
type IndicatorState = Record<IndicatorKey, boolean>

interface LineSpec {
  key: LineKey
  label: string
  short: string
  color: string
  width: LineWidth
  style: LineStyle
  compute: (closes: number[]) => Series
}

// Neutrals plus one blue (DESIGN.md: one accent per surface), told apart by lightness and dash.
const LINES: LineSpec[] = [
  { key: 'ema20', label: 'EMA 20', short: 'EMA20', color: '#e6e6e6', width: 1, style: LineStyle.Solid, compute: (c) => ema(c, 20) },
  { key: 'ema50', label: 'EMA 50', short: 'EMA50', color: '#63a1ff', width: 1, style: LineStyle.Solid, compute: (c) => ema(c, 50) },
  { key: 'ema200', label: 'EMA 200', short: 'EMA200', color: '#9c9c9d', width: 2, style: LineStyle.Solid, compute: (c) => ema(c, 200) },
  { key: 'sma20', label: 'SMA 20', short: 'SMA20', color: '#e6e6e6', width: 1, style: LineStyle.Dotted, compute: (c) => sma(c, 20) },
]
const RSI_COLOR = '#63a1ff'
const RSI_PERIOD = 14
const RSI_PANE_HEIGHT = 100
const INDICATOR_KEYS: IndicatorKey[] = ['ema20', 'ema50', 'ema200', 'sma20', 'rsi']
const DEFAULT_INDICATORS: IndicatorState = { ema20: true, ema50: true, ema200: false, sma20: false, rsi: false }
const INDICATORS_KEY = 'dispel-chart-indicators'

function loadIndicators(): IndicatorState {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(INDICATORS_KEY) ?? 'null')
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return DEFAULT_INDICATORS
    const stored = parsed as Record<string, unknown>
    const next = { ...DEFAULT_INDICATORS }
    for (const key of INDICATOR_KEYS) {
      const value = stored[key]
      if (typeof value === 'boolean') next[key] = value
    }
    return next
  } catch {
    return DEFAULT_INDICATORS
  }
}

interface Ohlc {
  open: number
  high: number
  low: number
  close: number
}

interface Computed {
  lines: Record<LineKey, Series>
  rsi: Series
}

interface Readout {
  ohlc: Ohlc
  lines: Record<LineKey, number | null>
  rsi: number | null
}

function compute(candles: Candle[]): Computed {
  const closes = candles.map((candle) => candle.close)
  const lines: Record<LineKey, Series> = { ema20: [], ema50: [], ema200: [], sma20: [] }
  for (const spec of LINES) lines[spec.key] = spec.compute(closes)
  return { lines, rsi: rsi(closes, RSI_PERIOD) }
}

function toLineData(candles: Candle[], series: Series): Array<{ time: UTCTimestamp; value: number }> {
  const data: Array<{ time: UTCTimestamp; value: number }> = []
  candles.forEach((candle, index) => {
    const value = series[index]
    if (value !== null && value !== undefined) data.push({ time: candle.time as UTCTimestamp, value })
  })
  return data
}

function readoutAt(candles: Candle[], computed: Computed, index: number): Readout | null {
  const candle = candles[index]
  if (!candle) return null
  const lines: Record<LineKey, number | null> = { ema20: null, ema50: null, ema200: null, sma20: null }
  for (const spec of LINES) lines[spec.key] = computed.lines[spec.key][index] ?? null
  return {
    ohlc: { open: candle.open, high: candle.high, low: candle.low, close: candle.close },
    lines,
    rsi: computed.rsi[index] ?? null,
  }
}

function LineSwatch({ color, dotted }: { color: string; dotted: boolean }) {
  return (
    <svg viewBox="0 0 14 6" aria-hidden="true">
      <line
        x1="1"
        y1="3"
        x2="13"
        y2="3"
        stroke={color}
        strokeWidth="1.6"
        strokeDasharray={dotted ? '1.5 2.5' : undefined}
        strokeLinecap="round"
      />
    </svg>
  )
}

function RsiSwatch() {
  return (
    <svg viewBox="0 0 14 6" aria-hidden="true">
      <path d="M0 4 3 2 6 4.5 9 1.5 14 3" fill="none" stroke={RSI_COLOR} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function TradingChart({ market, setup }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const lineRefs = useRef<Partial<Record<LineKey, ISeriesApi<'Line'>>>>({})
  const rsiRef = useRef<ISeriesApi<'Line'> | null>(null)
  const candlesRef = useRef<Candle[]>([])
  const computedRef = useRef<Computed>(compute([]))
  const hoverRef = useRef<number | null>(null)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const lastCandleRef = useRef<Ohlc | null>(null)
  const lastTimeRef = useRef<UTCTimestamp | null>(null)
  const tipRef = useRef<HTMLDivElement | null>(null)
  const positionTipRef = useRef<() => void>(() => {})
  const layoutRsiRef = useRef<() => void>(() => {})

  const [timeframe, setTimeframe] = useState<Timeframe>('15m')
  const [volumeOn, setVolumeOn] = useState(true)
  const [levelsOn, setLevelsOn] = useState(true)
  const [indicators, setIndicators] = useState<IndicatorState>(loadIndicators)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [readout, setReadout] = useState<Readout | null>(null)
  const [rsiTop, setRsiTop] = useState<number | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      localization: { locale: 'en-US' },
      layout: {
        background: { color: 'transparent' },
        textColor: COLORS.text,
        fontSize: 11,
        fontFamily: "'Geist Mono Variable', 'Geist Mono', monospace",
        panes: { separatorColor: 'rgba(255,255,255,0.08)', separatorHoverColor: 'rgba(255,255,255,0.12)' },
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.grid },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.04)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.04)', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
    })

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      borderUpColor: COLORS.up,
      borderDownColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      priceLineStyle: LineStyle.Dashed,
      priceLineColor: '#9c9c9d',
    })

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } })

    for (const spec of LINES) {
      lineRefs.current[spec.key] = chart.addSeries(LineSeries, {
        color: spec.color,
        lineWidth: spec.width,
        lineStyle: spec.style,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        visible: false,
      })
    }

    chart.subscribeCrosshairMove((param) => {
      const index = param.time !== undefined && param.logical !== undefined ? Math.round(param.logical) : null
      hoverRef.current = index
      setReadout(readoutAt(candlesRef.current, computedRef.current, index ?? candlesRef.current.length - 1))
    })

    chartRef.current = chart
    candleRef.current = candles
    volumeRef.current = volume

    const positionTip = () => {
      const tip = tipRef.current
      const series = candleRef.current
      const last = lastCandleRef.current
      const time = lastTimeRef.current
      if (!tip || !series || !last || time === null) return
      const y = series.priceToCoordinate(last.close)
      const x = chart.timeScale().timeToCoordinate(time)
      if (x === null || y === null) {
        tip.style.display = 'none'
        return
      }
      tip.style.display = ''
      tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
    }
    positionTipRef.current = positionTip
    chart.timeScale().subscribeVisibleTimeRangeChange(positionTip)

    // The RSI pane keeps a fixed height; its label sits at the pane's top, read after layout.
    let layoutFrame = 0
    const layoutRsi = () => {
      chart.panes()[1]?.setHeight(RSI_PANE_HEIGHT)
      cancelAnimationFrame(layoutFrame)
      layoutFrame = requestAnimationFrame(() => {
        setRsiTop(chart.panes().length > 1 ? chart.paneSize(0).height + 6 : null)
        positionTip()
      })
    }
    layoutRsiRef.current = layoutRsi

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight })
      positionTip()
      layoutRsi()
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(layoutFrame)
      chart.timeScale().unsubscribeVisibleTimeRangeChange(positionTip)
      positionTipRef.current = () => {}
      layoutRsiRef.current = () => {}
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
      lineRefs.current = {}
      rsiRef.current = null
      priceLinesRef.current = []
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    candlesRef.current = []
    hoverRef.current = null
    if (tipRef.current) tipRef.current.style.display = 'none'

    fetchKlines(market.symbol, timeframe)
      .then((candles) => {
        if (cancelled) return
        const candleSeries = candleRef.current
        const volumeSeries = volumeRef.current
        if (!candleSeries || !volumeSeries) return

        candleSeries.setData(
          candles.map((candle) => ({
            time: candle.time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          })),
        )
        volumeSeries.setData(
          candles.map((candle) => ({
            time: candle.time as UTCTimestamp,
            value: candle.volume,
            color: candle.close >= candle.open ? COLORS.upVolume : COLORS.downVolume,
          })),
        )
        candlesRef.current = candles
        computedRef.current = compute(candles)
        for (const spec of LINES) {
          lineRefs.current[spec.key]?.setData(toLineData(candles, computedRef.current.lines[spec.key]))
        }
        rsiRef.current?.setData(toLineData(candles, computedRef.current.rsi))

        const last = candles[candles.length - 1]
        if (last) {
          lastCandleRef.current = { open: last.open, high: last.high, low: last.low, close: last.close }
          lastTimeRef.current = last.time as UTCTimestamp
        }
        setReadout(readoutAt(candles, computedRef.current, candles.length - 1))
        chartRef.current?.timeScale().fitContent()
        positionTipRef.current()
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Failed to load chart data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [market.symbol, timeframe, reloadKey])

  useEffect(() => {
    return subscribeKline(market.symbol, timeframe, (candle) => {
      const candleSeries = candleRef.current
      const volumeSeries = volumeRef.current
      const history = candlesRef.current
      const previous = history[history.length - 1]
      // Ignore ticks until this market's history is loaded, and stale ticks from before it.
      if (!candleSeries || !volumeSeries || !previous || candle.time < previous.time) return

      const time = candle.time as UTCTimestamp
      candleSeries.update({
        time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })
      volumeSeries.update({
        time,
        value: candle.volume,
        color: candle.close >= candle.open ? COLORS.upVolume : COLORS.downVolume,
      })

      if (candle.time === previous.time) history[history.length - 1] = candle
      else history.push(candle)
      computedRef.current = compute(history)
      for (const spec of LINES) {
        const value = computedRef.current.lines[spec.key].at(-1)
        if (value !== null && value !== undefined) lineRefs.current[spec.key]?.update({ time, value })
      }
      const rsiValue = computedRef.current.rsi.at(-1)
      if (rsiValue !== null && rsiValue !== undefined) rsiRef.current?.update({ time, value: rsiValue })

      lastCandleRef.current = { open: candle.open, high: candle.high, low: candle.low, close: candle.close }
      lastTimeRef.current = time
      if (hoverRef.current === null) setReadout(readoutAt(history, computedRef.current, history.length - 1))
      positionTipRef.current()
    })
  }, [market.symbol, timeframe])

  useEffect(() => {
    for (const spec of LINES) lineRefs.current[spec.key]?.applyOptions({ visible: indicators[spec.key] })
    try {
      localStorage.setItem(INDICATORS_KEY, JSON.stringify(indicators))
    } catch {
      // Storage can be unavailable; the choice then lasts for this session only.
    }
  }, [indicators])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !indicators.rsi) return

    const series = chart.addSeries(
      LineSeries,
      {
        color: RSI_COLOR,
        lineWidth: 1,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
        autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
      },
      1,
    )
    for (const level of [70, 30]) {
      series.createPriceLine({ price: level, color: COLORS.guide, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '' })
    }
    series.createPriceLine({ price: 50, color: COLORS.midline, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: false, title: '' })
    series.setData(toLineData(candlesRef.current, computedRef.current.rsi))
    rsiRef.current = series
    layoutRsiRef.current()

    return () => {
      rsiRef.current = null
      setRsiTop(null)
      // On unmount the chart is already removed with everything in it.
      if (chartRef.current !== chart) return
      chart.removeSeries(series)
      if (chart.panes().length > 1) chart.removePane(1)
    }
  }, [indicators.rsi])

  useEffect(() => {
    const candleSeries = candleRef.current
    if (!candleSeries) return

    for (const line of priceLinesRef.current) {
      candleSeries.removePriceLine(line)
    }
    priceLinesRef.current = []

    if (!levelsOn) return
    if (!setup) return

    const invalidation = Number.parseFloat(setup.invalidation.value.replace(/,/g, ''))
    const target = Number.parseFloat(setup.target.value.replace(/,/g, ''))
    if (Number.isFinite(invalidation)) {
      priceLinesRef.current.push(
        candleSeries.createPriceLine({
          price: invalidation,
          color: COLORS.down,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Invalid',
        }),
      )
    }
    if (Number.isFinite(target)) {
      priceLinesRef.current.push(
        candleSeries.createPriceLine({
          price: target,
          color: '#6a6b6c',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Target',
        }),
      )
    }
  }, [levelsOn, setup])

  useEffect(() => {
    volumeRef.current?.applyOptions({ visible: volumeOn })
  }, [volumeOn])

  // Without this the scale keeps the default 2 decimals: low-priced pairs (PENGU, DOGE) collapse
  // onto 0.01 steps and the live-price tip is placed on the rounded price.
  useEffect(() => {
    const precision = market.pricePrecision
    candleRef.current?.applyOptions({ priceFormat: { type: 'price', precision, minMove: 10 ** -precision } })
    positionTipRef.current()
  }, [market.pricePrecision])

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')) return
      if ((event.key === 'l' || event.key === 'L') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        setLevelsOn((on) => !on)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  function toggleIndicator(key: IndicatorKey) {
    setIndicators((current) => ({ ...current, [key]: !current[key] }))
  }

  const precision = market.pricePrecision

  return (
    <section className="panel chart-p" aria-label="Price chart">
      <div className="ch-bar">
        <div className="tf" role="group" aria-label="Timeframe">
          {TIMEFRAMES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={item === timeframe}
              onClick={() => setTimeframe(item)}
            >
              {TIMEFRAME_LABELS[item] ?? item}
            </button>
          ))}
        </div>
        <div className="ch-tools">
          <div className="ind" role="group" aria-label="Indicators">
            {LINES.map((spec) => (
              <button
                key={spec.key}
                type="button"
                aria-pressed={indicators[spec.key]}
                onClick={() => toggleIndicator(spec.key)}
              >
                <LineSwatch color={spec.color} dotted={spec.style === LineStyle.Dotted} />
                {spec.label}
              </button>
            ))}
            <span className="sep" />
            <button type="button" aria-pressed={indicators.rsi} onClick={() => toggleIndicator('rsi')}>
              <RsiSwatch />
              RSI
            </button>
          </div>
          <span className="tg">
            <button
              type="button"
              className="toggle"
              aria-pressed={levelsOn}
              onClick={() => setLevelsOn((on) => !on)}
            >
              <i />
              Setup levels
            </button>
            <button
              type="button"
              className="toggle"
              aria-pressed={volumeOn}
              onClick={() => setVolumeOn((on) => !on)}
            >
              <i />
              Volume
            </button>
          </span>
        </div>
      </div>
      <div className={indicators.rsi ? 'chart has-rsi' : 'chart'}>
        <div className="ohlc">
          {readout ? (
            <>
              <span>
                O<b>{readout.ohlc.open.toFixed(precision)}</b>
              </span>
              <span>
                H<b>{readout.ohlc.high.toFixed(precision)}</b>
              </span>
              <span>
                L<b>{readout.ohlc.low.toFixed(precision)}</b>
              </span>
              <span>
                C<b>{readout.ohlc.close.toFixed(precision)}</b>
              </span>
              {LINES.map((spec) => {
                const value = readout.lines[spec.key]
                if (!indicators[spec.key] || value === null) return null
                return (
                  <span key={spec.key}>
                    {spec.short}
                    <b style={{ color: spec.color }}>{value.toFixed(precision)}</b>
                  </span>
                )
              })}
            </>
          ) : null}
        </div>
        {indicators.rsi && rsiTop !== null ? (
          <div className="rsi-label" style={{ top: rsiTop }}>
            RSI {RSI_PERIOD}
            <b>{readout?.rsi !== null && readout?.rsi !== undefined ? readout.rsi.toFixed(1) : '—'}</b>
          </div>
        ) : null}
        <div ref={containerRef} className="chart-host" />
        <div ref={tipRef} className="chart-tip" style={{ display: 'none' }} aria-hidden="true">
          <span className="tip-glow" />
          <span className="tip-ring" />
          <span className="tip-core" />
        </div>
        {loading ? <div className="chart-state">Loading chart…</div> : null}
        {error ? (
          <div className="chart-error">
            <p>{error}</p>
            <button type="button" className="btn2" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
