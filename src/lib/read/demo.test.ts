import { describe, expect, it } from 'vitest'
import {
  DEMO_READS,
  DEMO_READ,
  isCloseSplit,
  isNearEven,
  oddsCertainty,
  oddsTexture,
  regimeAt,
  series,
  setupCertainty,
} from './demo'
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
      expect(read.evidence).toHaveLength(8)
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

describe('confidence display helpers', () => {
  it('treats odds between 40% and 60% as near even', () => {
    expect(isNearEven(53)).toBe(true)
    expect(isNearEven(41)).toBe(true)
    expect(isNearEven(60)).toBe(false)
    expect(isNearEven(68)).toBe(false)
  })

  it('grades odds by distance from a coin flip', () => {
    expect(oddsCertainty(53)).toBe(0)
    expect(oddsCertainty(68)).toBe(1)
    expect(oddsCertainty(25)).toBe(2)
    expect(oddsCertainty(90)).toBe(2)
  })

  it('takes the weaker of pattern and odds certainty', () => {
    expect(setupCertainty(2, 53)).toBe(0)
    expect(setupCertainty(2, 68)).toBe(1)
    expect(setupCertainty(1, 90)).toBe(1)
    expect(setupCertainty(2, null)).toBe(2)
  })

  it('reads a top-to-second ratio under 1.5 as a close split', () => {
    expect(isCloseSplit([{ pct: 41 }, { pct: 37 }])).toBe(true)
    expect(isCloseSplit([{ pct: 60 }, { pct: 20 }])).toBe(false)
    expect(isCloseSplit([{ pct: 60 }])).toBe(false)
  })
})

