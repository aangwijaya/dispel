import { describe, expect, it } from 'vitest'
import { ageMinutesOf, freshnessOf, toLiveRead, toReadPayload } from './live'
import { DEMO_READ } from './demo'

const ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  created_at: '2026-09-28T14:30:00.000Z',
  as_of: '2026-09-28T14:30:00.000Z',
  status: 'ok',
  model: 'jev-1.13.0',
  read: DEMO_READ,
}

describe('toReadPayload', () => {
  it('accepts the composed payload shape', () => {
    expect(toReadPayload(DEMO_READ)).not.toBeNull()
  })

  it('rejects malformed payloads', () => {
    expect(toReadPayload(null)).toBeNull()
    expect(toReadPayload({})).toBeNull()
    expect(toReadPayload({ ...DEMO_READ, stats: { strength: 'x' } })).toBeNull()
    expect(toReadPayload({ ...DEMO_READ, biasTone: 'loud' })).toBeNull()
    expect(
      toReadPayload({ ...DEMO_READ, setups: [{ ...DEMO_READ.setups[0], invalidation: null }] }),
    ).toBeNull()
    expect(toReadPayload({ ...DEMO_READ, shift: { time: 1 } })).toBeNull()
  })
})

describe('toLiveRead', () => {
  it('accepts a valid row and keeps its metadata', () => {
    const live = toLiveRead(ROW)
    expect(live?.id).toBe(ROW.id)
    expect(live?.status).toBe('ok')
    expect(live?.read.stance).toBe('favorable')
  })

  it('rejects rows with a bad status or payload', () => {
    expect(toLiveRead({ ...ROW, status: 'weird' })).toBeNull()
    expect(toLiveRead({ ...ROW, read: {} })).toBeNull()
    expect(toLiveRead({ ...ROW, created_at: undefined })).toBeNull()
  })
})

describe('freshnessOf', () => {
  const now = Date.parse('2026-09-28T15:00:00.000Z')

  it('marks reads younger than 20 minutes fresh', () => {
    expect(freshnessOf('2026-09-28T14:41:00.000Z', now)).toBe('fresh')
  })

  it('marks 20 to 45 minutes stale', () => {
    expect(freshnessOf('2026-09-28T14:40:00.000Z', now)).toBe('stale')
    expect(freshnessOf('2026-09-28T14:16:00.000Z', now)).toBe('stale')
  })

  it('marks anything older than 45 minutes expired', () => {
    expect(freshnessOf('2026-09-28T14:14:00.000Z', now)).toBe('expired')
    expect(freshnessOf('not a date', now)).toBe('expired')
  })

  it('reports the age in minutes', () => {
    expect(ageMinutesOf('2026-09-28T14:13:00.000Z', now)).toBe(47)
  })
})
