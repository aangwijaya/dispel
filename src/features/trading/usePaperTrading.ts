import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelOrder, fetchAccount, fetchOrders, fetchPositions, fillOrder, placeOrder } from '../../lib/orders'
import type { PlaceOrderPayload } from '../../lib/orders'
import type { Order, PaperAccount, Position } from '../../types/trading'
import { dec } from '../../lib/decimal'
import { useTickers } from './useTickers'

const FILL_RETRY_COOLDOWN_MS = 30000

export interface PaperTrading {
  account: PaperAccount | null
  positions: Position[]
  openOrders: Order[]
  history: Order[]
  loading: boolean
  error: string | null
  place: (payload: PlaceOrderPayload) => Promise<Order>
  cancel: (orderId: string) => Promise<void>
  refresh: () => Promise<void>
}

export function usePaperTrading(enabled: boolean): PaperTrading {
  const [account, setAccount] = useState<PaperAccount | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef<Set<string>>(new Set())
  const retryAfterRef = useRef<Map<string, number>>(new Map())

  const refresh = useCallback(async () => {
    try {
      const [nextAccount, nextPositions, nextOrders] = await Promise.all([
        fetchAccount(),
        fetchPositions(),
        fetchOrders(),
      ])
      setAccount(nextAccount)
      setPositions(nextPositions)
      setOrders(nextOrders)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load the paper account.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void refresh()
  }, [enabled, refresh])

  const openOrders = orders.filter((order) => order.status === 'open')
  const history = orders.filter((order) => order.status !== 'open')
  const limitSymbols = [...new Set(openOrders.filter((order) => order.type === 'limit').map((order) => order.symbol))]
  const tickers = useTickers(enabled ? limitSymbols : [])

  useEffect(() => {
    if (!enabled) return
    const now = Date.now()

    for (const order of openOrders) {
      if (order.type !== 'limit' || order.limitPrice === null) continue
      const ticker = tickers[order.symbol]
      if (!ticker) continue

      const crossed =
        order.side === 'buy' ? dec(ticker.lastPrice).lte(order.limitPrice) : dec(ticker.lastPrice).gte(order.limitPrice)
      if (!crossed) continue
      if (inFlightRef.current.has(order.id)) continue
      if ((retryAfterRef.current.get(order.id) ?? 0) > now) continue

      inFlightRef.current.add(order.id)
      fillOrder(order.id, ticker.lastPrice)
        .then(() => refresh())
        .catch(() => {
          retryAfterRef.current.set(order.id, Date.now() + FILL_RETRY_COOLDOWN_MS)
        })
        .finally(() => {
          inFlightRef.current.delete(order.id)
        })
    }
  }, [enabled, openOrders, tickers, refresh])

  const place = useCallback(
    async (payload: PlaceOrderPayload) => {
      const order = await placeOrder(payload)
      await refresh()
      return order
    },
    [refresh],
  )

  const cancel = useCallback(
    async (orderId: string) => {
      await cancelOrder(orderId)
      await refresh()
    },
    [refresh],
  )

  return { account, positions, openOrders, history, loading, error, place, cancel, refresh }
}
