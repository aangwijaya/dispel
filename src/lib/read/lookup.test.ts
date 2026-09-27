import { describe, expect, it } from 'vitest'
import { baseAssetOf, setupForSymbol } from './lookup'
import { DEMO_READ, DEMO_READS } from './demo'

describe('setupForSymbol', () => {
  it('matches by base asset for both symbol shapes', () => {
    expect(setupForSymbol(DEMO_READ, 'SOLUSDT')?.monogram).toBe('SOL')
    expect(setupForSymbol(DEMO_READ, 'SOL/USDT')?.monogram).toBe('SOL')
  })

  it('falls back to forming candidates', () => {
    const wait = DEMO_READS.wait
    expect(wait.forming.length).toBeGreaterThan(0)
    expect(setupForSymbol(wait, 'ETHUSDT')).not.toBeNull()
  })

  it('returns null when no setup covers the market', () => {
    expect(setupForSymbol(DEMO_READ, 'XRPUSDT')).toBeNull()
  })

  it('exposes the base asset helper', () => {
    expect(baseAssetOf('LINKUSDT')).toBe('LINK')
  })
})
