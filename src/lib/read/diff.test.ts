import { describe, expect, it } from 'vitest'
import { changedCount, diffReads } from './diff'
import { DEMO_READ } from './demo'
import type { ReadPayload } from '../../types/read'

function payload(overrides: Partial<ReadPayload> = {}): ReadPayload {
  const base: ReadPayload = DEMO_READ
  return { ...base, ...overrides }
}

describe('diffReads', () => {
  it('reports unchanged bias and risk as same', () => {
    const rows = diffReads(payload(), payload())
    expect(rows.map((row) => row.label)).toEqual(['Bias', 'Risk'])
    expect(rows.every((row) => row.kind === 'same')).toBe(true)
    expect(changedCount(rows)).toBe(0)
  })

  it('reports a bias change with an arrow', () => {
    const rows = diffReads(payload(), payload({ bias: 'Bearish' }))
    expect(rows[0]).toMatchObject({ kind: 'chg', label: 'Bias' })
    expect(rows[0]?.text).toContain('→')
  })

  it('reports a regime change', () => {
    const rows = diffReads(payload({ regimeIndex: 1 }), payload({ regimeIndex: 3 }))
    const regime = rows.find((row) => row.label === 'Regime')
    expect(regime).toMatchObject({ kind: 'chg' })
    expect(regime?.text).toContain('Cautious → Constructive')
  })

  it('reports setup moves and caps the rows at four', () => {
    const previous = payload({ setups: [DEMO_READ.setups[0]!, DEMO_READ.setups[1]!] })
    const current = payload({ setups: [DEMO_READ.setups[1]!, DEMO_READ.setups[2]!] })
    const rows = diffReads(previous, current)
    expect(rows).toHaveLength(4)
    expect(rows.some((row) => row.kind === 'new' && row.text.includes('added'))).toBe(true)
    expect(rows.some((row) => row.kind === 'end' && row.text.includes('removed'))).toBe(true)
  })
})
