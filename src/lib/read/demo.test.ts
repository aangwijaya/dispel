import { describe, expect, it } from 'vitest'
import { DEMO_READS, DEMO_READ, oddsTexture, regimeAt, series } from './demo'
import type { Stance } from '../../types/read'

const STANCES: Stance[] = ['favorable', 'wait', 'unclear', 'reduce-risk']

describe('demo read layer', () => {
  it('exposes every stance with the fixed verdict vocabulary', () => {
    for (const stance of STANCES) {
      const read = DEMO_READS[stance]
      expect(read.stance).toBe(stance)
      expect([
        'Look for setups',
        'Be selective',
        'Wait.',
        'No clear read',
        'Reduce risk',
      ]).toContain(read.verdict)
    }
  })

  it('keeps odds inside 0-100 or null and names a confidence texture', () => {
    for (const stance of STANCES) {
      for (const setup of DEMO_READS[stance].setups) {
        if (setup.odds !== null) {
          expect(setup.odds).toBeGreaterThan(0)
          expect(setup.odds).toBeLessThanOrEqual(100)
        }
        expect(['', 'thin', 'medium']).toContain(oddsTexture(setup.confidence))
      }
    }
  })

  it('always carries exactly one caution and six evidence wells', () => {
    for (const stance of STANCES) {
      const read = DEMO_READS[stance]
      expect(read.caution.length).toBeGreaterThan(0)
      expect(read.evidence).toHaveLength(6)
    }
  })

  it('generates deterministic series that end on the last anchor', () => {
    const first = series([1, 2, 3, 4], 7, 20)
    const second = series([1, 2, 3, 4], 7, 20)
    expect(first).toEqual(second)
    expect(first[first.length - 1]).toBe(4)
    expect(series([], 1)).toEqual([])
  })

  it('names regimes and falls back to Neutral', () => {
    expect(regimeAt(3).name).toBe('Constructive')
    expect(regimeAt(99).name).toBe('Neutral')
  })

  it('ships a default favorable read for sign-in and Home', () => {
    expect(DEMO_READ.stance).toBe('favorable')
    expect(DEMO_READ.setups.length).toBeGreaterThan(0)
  })
})
