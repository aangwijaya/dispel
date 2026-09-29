import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEMO_READ } from '../../lib/read/demo'
import { diffReads } from '../../lib/read/diff'
import { buildExposure } from '../../lib/read/exposure'
import {
  ageMinutesOf,
  fetchLatestRead,
  fetchReadPayloadById,
  freshnessOf,
  type LiveRead,
} from '../../lib/read/live'
import type { MarketRead, ReadPayload, SinceRow } from '../../types/read'
import type { Position } from '../../types/trading'

const SEEN_KEY = 'dispel-read-seen'
const POLL_MS = 5 * 60_000

interface SeenState {
  id: string
  seenAt: string
}

function readSeen(): SeenState | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const record = parsed as Record<string, unknown>
    if (typeof record.id !== 'string') return null
    return { id: record.id, seenAt: typeof record.seenAt === 'string' ? record.seenAt : new Date().toISOString() }
  } catch {
    return null
  }
}

function writeSeen(id: string): SeenState {
  const next = { id, seenAt: new Date().toISOString() }
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(next))
  } catch {
    // Storage failures only cost the since-diff.
  }
  return next
}

export interface UseMarketReadInput {
  positions: Position[]
  marks: Record<string, string>
  /** Sign-in previews should not consume the first-visit diff. */
  trackSeen?: boolean
}

export interface MarketReadState {
  read: MarketRead
  source: 'live' | 'demo'
  status: 'ok' | 'degraded' | 'demo'
  stale: boolean
  staleMinutes: number
  since: SinceRow[] | null
  seenAt: string | null
  readAt: string | null
  loading: boolean
  refresh: () => void
}

export function useMarketRead({ positions, marks, trackSeen = true }: UseMarketReadInput): MarketReadState {
  const [live, setLive] = useState<LiveRead | null>(null)
  const [since, setSince] = useState<SinceRow[] | null>(null)
  const [seenAt, setSeenAt] = useState<string | null>(() => readSeen()?.seenAt ?? null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [refreshKey, setRefreshKey] = useState(0)
  const seenRef = useRef<SeenState | null>(readSeen())

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const latest = await fetchLatestRead()
        if (cancelled) return
        setLive(latest)
        if (!latest) return

        const seen = seenRef.current
        if (seen === null) {
          if (trackSeen) {
            seenRef.current = writeSeen(latest.id)
            setSeenAt(seenRef.current.seenAt)
          }
          setSince(null)
          return
        }
        if (seen.id === latest.id || !trackSeen) return

        const previous = await fetchReadPayloadById(seen.id)
        if (cancelled) return
        if (previous) setSince(diffReads(previous, latest.read))
        seenRef.current = writeSeen(latest.id)
        setSeenAt(seenRef.current.seenAt)
      } catch {
        if (!cancelled) setLive(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [refreshKey, trackSeen])

  useEffect(() => {
    const onFocus = () => refresh()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    const timer = window.setInterval(refresh, POLL_MS)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
    }
  }, [refresh])

  const freshness = live ? freshnessOf(live.readAt, now) : 'expired'
  const useLive = live !== null && freshness !== 'expired'
  const payload: ReadPayload = useLive && live ? live.read : DEMO_READ
  const exposure = useMemo(
    () => buildExposure({ positions, marks, setups: payload.setups }),
    [positions, marks, payload],
  )
  const read = useMemo<MarketRead>(() => ({ ...payload, exposure, since: since ?? [] }), [payload, exposure, since])

  return {
    read,
    source: useLive ? 'live' : 'demo',
    status: useLive && live ? live.status : 'demo',
    stale: useLive && freshness === 'stale',
    staleMinutes: live ? ageMinutesOf(live.readAt, now) : 0,
    since,
    seenAt,
    readAt: useLive && live ? live.readAt : null,
    loading,
    refresh,
  }
}
