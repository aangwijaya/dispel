import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { fetchKlines } from '../../lib/market/binance'
import { subscribeKline } from '../../lib/market/stream'
import { setupForSymbol } from '../../lib/read/demo'
import { TIMEFRAMES, type Market, type Timeframe } from '../../types/market'

interface TradingChartProps {
  market: Market
}

const COLORS = {
  text: '#6a6b6c',
  grid: 'rgba(255,255,255,0.04)',
  up: '#59d499',
  down: '#f0506e',
  upVolume: 'rgba(89,212,153,0.28)',
  downVolume: 'rgba(240,80,110,0.28)',
}

interface Ohlc {
  open: number
  high: number
  low: number
  close: number
}

export function TradingChart({ market }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const lastCandleRef = useRef<Ohlc | null>(null)

  const [timeframe, setTimeframe] = useState<Timeframe>('15m')
  const [volumeOn, setVolumeOn] = useState(true)
  const [levelsOn, setLevelsOn] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [ohlc, setOhlc] = useState<Ohlc | null>(null)

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

    chart.subscribeCrosshairMove((param) => {
      const data = param.seriesData.get(candles) as Ohlc | undefined
      if (data && 'open' in data) {
        setOhlc({ open: data.open, high: data.high, low: data.low, close: data.close })
      } else if (lastCandleRef.current) {
        setOhlc(lastCandleRef.current)
      }
    })

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
      priceLinesRef.current = []
    }
  }, [])

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
        const last = candles[candles.length - 1]
        if (last) {
          lastCandleRef.current = { open: last.open, high: last.high, low: last.low, close: last.close }
          setOhlc(lastCandleRef.current)
        }
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
  }, [market.symbol, timeframe, reloadKey])

  useEffect(() => {
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
        color: candle.close >= candle.open ? COLORS.upVolume : COLORS.downVolume,
      })
      lastCandleRef.current = { open: candle.open, high: candle.high, low: candle.low, close: candle.close }
      setOhlc(lastCandleRef.current)
    })
  }, [market.symbol, timeframe])

  useEffect(() => {
    const candleSeries = candleRef.current
    if (!candleSeries) return

    for (const line of priceLinesRef.current) {
      candleSeries.removePriceLine(line)
    }
    priceLinesRef.current = []

    if (!levelsOn) return
    const setup = setupForSymbol(market.symbol)
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
  }, [levelsOn, market.symbol])

  useEffect(() => {
    volumeRef.current?.applyOptions({ visible: volumeOn })
  }, [volumeOn])

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
              {item}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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
        </div>
      </div>
      <div className="chart">
        <div className="ohlc">
          {ohlc ? (
            <>
              <span>
                O<b>{ohlc.open.toFixed(precision)}</b>
              </span>
              <span>
                H<b>{ohlc.high.toFixed(precision)}</b>
              </span>
              <span>
                L<b>{ohlc.low.toFixed(precision)}</b>
              </span>
              <span>
                C<b>{ohlc.close.toFixed(precision)}</b>
              </span>
            </>
          ) : null}
        </div>
        <div ref={containerRef} className="chart-host" />
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
