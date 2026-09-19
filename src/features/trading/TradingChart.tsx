import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { fetchKlines } from '../../lib/market/binance'
import { subscribeKline } from '../../lib/market/stream'
import { TIMEFRAMES, type Market, type Timeframe } from '../../types/market'
import type { Theme } from '../../lib/theme'

interface TradingChartProps {
  market: Market
  theme: Theme
}

const LIGHT_COLORS = {
  text: '#474645',
  grid: '#f2f0ed',
  up: '#00a35f',
  down: '#e01b2b',
  upVolume: 'rgba(0,163,95,0.30)',
  downVolume: 'rgba(224,27,43,0.30)',
}

const DARK_COLORS = {
  text: '#c9c8c6',
  grid: '#1f1f1e',
  up: '#00c978',
  down: '#ff4d59',
  upVolume: 'rgba(0,201,120,0.30)',
  downVolume: 'rgba(255,77,89,0.30)',
}

export function TradingChart({ market, theme }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const [timeframe, setTimeframe] = useState<Timeframe>('15m')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const colors = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      localization: { locale: 'en-US' },
      layout: {
        background: { color: 'transparent' },
        textColor: colors.text,
        fontSize: 11,
        fontFamily: "'Inter Variable', Inter, sans-serif",
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: { borderColor: colors.grid },
      timeScale: { borderColor: colors.grid, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
    })

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: colors.up,
      downColor: colors.down,
      borderUpColor: colors.up,
      borderDownColor: colors.down,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
    })

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

    chartRef.current = chart
    candleRef.current = candles
    volumeRef.current = volume

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight })
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
    }
  }, [theme])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchKlines(market.symbol, timeframe)
      .then((candles) => {
        if (cancelled) return
        const candleSeries = candleRef.current
        const volumeSeries = volumeRef.current
        if (!candleSeries || !volumeSeries) return

        const colors = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS
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
            color: candle.close >= candle.open ? colors.upVolume : colors.downVolume,
          })),
        )
        chartRef.current?.timeScale().fitContent()
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
  }, [market.symbol, timeframe, theme, reloadKey])

  useEffect(() => {
    const colors = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS
    return subscribeKline(market.symbol, timeframe, (candle) => {
      const candleSeries = candleRef.current
      const volumeSeries = volumeRef.current
      if (!candleSeries || !volumeSeries) return

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
        color: candle.close >= candle.open ? colors.upVolume : colors.downVolume,
      })
    })
  }, [market.symbol, timeframe, theme])

  return (
    <section className="flex min-h-0 flex-1 flex-col border-b border-edge bg-panel">
      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-hairline px-2">
        {TIMEFRAMES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTimeframe(item)}
            className={`h-6 rounded-md px-2 text-micro font-medium transition-colors ${
              item === timeframe ? 'bg-inset text-ink' : 'text-faint hover:text-ink'
            }`}
          >
            {item}
          </button>
        ))}
        <span className="ml-auto text-micro text-faint">{market.displayName} · Binance spot</span>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        {loading ? (
          <div className="absolute left-3 top-2 text-micro text-faint">Loading chart…</div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-panel/80">
            <p className="text-caption text-sell">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="h-7 rounded-pill border border-edge px-3 text-caption font-medium text-body hover:bg-inset hover:text-ink"
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
