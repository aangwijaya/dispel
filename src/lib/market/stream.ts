import { sanitizeAggTrade, sanitizeKline, sanitizeOrderBook, sanitizeTicker } from './binance'
import type { Candle, MarketTrade, OrderBook, Ticker, Timeframe } from '../../types/market'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
export type DisplayStatus = 'idle' | ConnectionStatus

export interface MarketHandlers {
  onTicker?: (ticker: Ticker) => void
  onOrderBook?: (book: OrderBook) => void
  onTrade?: (trade: MarketTrade) => void
}

const WS_HOSTS = ['wss://stream.binance.com:9443/stream', 'wss://data-stream.binance.vision/stream']
const SYMBOL_PATTERN = /^[A-Z0-9]{5,20}$/

let wsHostIndex = 0

interface Listener {
  symbol: string
  interval: Timeframe | null
  handlers: MarketHandlers
  onKline: ((candle: Candle, closed: boolean) => void) | null
}

let socket: WebSocket | null = null
let currentStatus: ConnectionStatus = 'disconnected'
let reconnectAttempts = 0
let reconnectTimer: number | null = null
let messageId = 1
let listenerId = 1

const listeners = new Map<number, Listener>()
const statusListeners = new Set<(status: DisplayStatus) => void>()

function displayStatus(): DisplayStatus {
  return listeners.size === 0 ? 'idle' : currentStatus
}

function notifyStatus(previous: DisplayStatus): void {
  const next = displayStatus()
  if (next === previous) return
  for (const listener of statusListeners) listener(next)
}

function streamsFor(listener: Listener): string[] {
  const base = listener.symbol.toLowerCase()
  const streams: string[] = []
  if (listener.handlers.onTicker) streams.push(`${base}@ticker`)
  if (listener.handlers.onOrderBook) streams.push(`${base}@depth20@100ms`)
  if (listener.handlers.onTrade) streams.push(`${base}@aggTrade`)
  if (listener.interval) streams.push(`${base}@kline_${listener.interval}`)
  return streams
}

function activeStreams(): string[] {
  const names = new Set<string>()
  for (const listener of listeners.values()) {
    for (const stream of streamsFor(listener)) names.add(stream)
  }
  return [...names]
}

function setStatus(status: ConnectionStatus): void {
  const previous = displayStatus()
  currentStatus = status
  notifyStatus(previous)
}

function send(payload: unknown): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload))
  }
}

function changeStreams(method: 'SUBSCRIBE' | 'UNSUBSCRIBE', names: string[]): void {
  if (names.length === 0) return
  send({ method, params: names, id: messageId++ })
}

function connect(): void {
  if (socket) return
  setStatus('connecting')
  const url = WS_HOSTS[wsHostIndex] ?? WS_HOSTS[0]
  if (!url) return
  const next = new WebSocket(url)
  socket = next
  let opened = false

  next.onopen = () => {
    opened = true
    reconnectAttempts = 0
    setStatus('connected')
    changeStreams('SUBSCRIBE', activeStreams())
  }

  next.onmessage = (event: MessageEvent) => {
    if (typeof event.data === 'string') dispatch(event.data)
  }

  next.onclose = () => {
    if (socket === next) socket = null
    if (!opened && WS_HOSTS.length > 1) {
      wsHostIndex = (wsHostIndex + 1) % WS_HOSTS.length
    }
    setStatus('disconnected')
    scheduleReconnect()
  }

  next.onerror = () => {
    next.close()
  }
}

function scheduleReconnect(): void {
  if (listeners.size === 0 || reconnectTimer !== null) return
  const delay = Math.min(1000 * 2 ** reconnectAttempts, 15000)
  reconnectAttempts += 1
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connect()
  }, delay)
}

function closeIfIdle(): void {
  if (listeners.size > 0) return
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  const current = socket
  socket = null
  if (current) current.close()
  setStatus('disconnected')
}

function handleData(listener: Listener, suffix: string, data: unknown): void {
  if (suffix === 'ticker') {
    const ticker = sanitizeTicker(data)
    if (ticker) listener.handlers.onTicker?.(ticker)
    return
  }
  if (suffix === 'aggTrade') {
    const trade = sanitizeAggTrade(data)
    if (trade) listener.handlers.onTrade?.(trade)
    return
  }
  if (suffix.startsWith('depth')) {
    const book = sanitizeOrderBook(data, listener.symbol)
    if (book) listener.handlers.onOrderBook?.(book)
    return
  }
  if (listener.onKline && suffix === `kline_${listener.interval}`) {
    const kline = sanitizeKline(data)
    if (kline) listener.onKline(kline.candle, kline.closed)
  }
}

function dispatch(raw: string): void {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return
  }
  if (typeof parsed !== 'object' || parsed === null) return

  const wrapper = parsed as { stream?: unknown; data?: unknown }
  if (typeof wrapper.stream !== 'string') return
  const stream = wrapper.stream
  const data = wrapper.data ?? parsed

  const separator = stream.indexOf('@')
  if (separator <= 0) return
  const symbol = stream.slice(0, separator)
  const suffix = stream.slice(separator + 1)

  for (const listener of listeners.values()) {
    if (listener.symbol.toLowerCase() !== symbol) continue
    handleData(listener, suffix, data)
  }
}

function addListener(listener: Listener): () => void {
  if (!SYMBOL_PATTERN.test(listener.symbol)) {
    throw new Error('Invalid market symbol')
  }

  const previousDisplay = displayStatus()
  const existing = new Set(activeStreams())
  const id = listenerId++
  listeners.set(id, listener)
  notifyStatus(previousDisplay)
  connect()
  changeStreams(
    'SUBSCRIBE',
    streamsFor(listener).filter((stream) => !existing.has(stream)),
  )

  return () => {
    const removed = listeners.get(id)
    if (!removed) return
    const previousDisplay = displayStatus()
    listeners.delete(id)
    notifyStatus(previousDisplay)

    const stillNeeded = new Set<string>()
    for (const remaining of listeners.values()) {
      for (const stream of streamsFor(remaining)) stillNeeded.add(stream)
    }
    changeStreams(
      'UNSUBSCRIBE',
      streamsFor(removed).filter((stream) => !stillNeeded.has(stream)),
    )
    closeIfIdle()
  }
}

export function subscribeMarket(symbol: string, handlers: MarketHandlers): () => void {
  return addListener({ symbol, interval: null, handlers, onKline: null })
}

export function subscribeKline(
  symbol: string,
  interval: Timeframe,
  onKline: (candle: Candle, closed: boolean) => void,
): () => void {
  return addListener({ symbol, interval, handlers: {}, onKline })
}

export function subscribeConnectionStatus(listener: (status: DisplayStatus) => void): () => void {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

export function getConnectionStatus(): DisplayStatus {
  return displayStatus()
}
