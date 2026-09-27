import { describe, expect, it } from 'vitest'
import { baseAssetOf, buildExposure } from './exposure'
import { DEMO_READ } from './demo'

const POSITIONS = [
  { symbol: 'SOLUSDT', quantity: '12.5', avgEntryPrice: '201.46', realizedPnl: '0', updatedAt: '2026-09-27T00:00:00Z' },
  { symbol: 'ETHUSDT', quantity: '0.6', avgEntryPrice: '4545.55', realizedPnl: '0', updatedAt: '2026-09-27T00:00:00Z' },
  { symbol: 'XRPUSDT', quantity: '100', avgEntryPrice: '1.4', realizedPnl: '0', updatedAt: '2026-09-27T00:00:00Z' },
]

describe('baseAssetOf', () => {
  it('reads both symbol shapes', () => {
    expect(baseAssetOf('SOLUSDT')).toBe('SOL')
    expect(baseAssetOf('SOL/USDT')).toBe('SOL')
  })
})

describe('buildExposure', () => {
  it('classifies invalidated, at risk and holding positions', () => {
    const exposure = buildExposure({
      positions: POSITIONS,
      marks: { SOLUSDT: '196.2', ETHUSDT: '4568.8' },
      setups: DEMO_READ.setups,
    })
    expect(exposure).toHaveLength(2)
    const sol = exposure.find((item) => item.monogram === 'SOL')
    const eth = exposure.find((item) => item.monogram === 'ETH')
    expect(sol?.status).toBe('Invalidated')
    expect(sol?.cushionPct).toBeNull()
    expect(eth?.status).toBe('At risk')
    expect(eth?.cushionPct).toBeGreaterThan(0)
    expect(exposure.some((item) => item.monogram === 'XRP')).toBe(false)
  })

  it('uses the average entry when no mark is available', () => {
    const exposure = buildExposure({
      positions: [{ ...POSITIONS[1]!, avgEntryPrice: '4600' }],
      marks: {},
      setups: DEMO_READ.setups,
    })
    expect(exposure).toHaveLength(1)
    expect(exposure[0]?.status).toBe('Holding')
  })
})
