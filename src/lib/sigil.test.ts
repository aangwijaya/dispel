import { describe, expect, it } from 'vitest'
import { SIGIL_TIP_ANGLE, arcAngles, dialSvg, sealSvg, sigilSvg, type SigilMood } from './sigil'

const ids = (svg: string): string[] => [...svg.matchAll(/id="([^"]+)"/g)].map((match) => match[1] ?? '')
const arcCount = (svg: string): number => (svg.match(/<path d="M/g) ?? []).length

describe('arcAngles', () => {
  it('starts at the tip and grows with strength', () => {
    expect(SIGIL_TIP_ANGLE).toBe(-35)
    expect(arcAngles(0)).toEqual({ from: -35, to: 5 })
    expect(arcAngles(71).from).toBe(-35)
    expect(arcAngles(71).to).toBeCloseTo(90.2, 10)
    expect(arcAngles(150)).toEqual({ from: -35, to: 125 })
  })
})

describe('sigilSvg', () => {
  it('puts the tip at -35 degrees', () => {
    const html = sigilSvg({ mood: 'favorable', idPrefix: 'tip', animate: false })
    expect(html).toContain('cx="335.9" cy="-235.2"')
  })

  it('uses the palette of every mood', () => {
    const palettes: Array<[SigilMood, string, string]> = [
      ['favorable', '#ffc07a', '#ff6363'],
      ['wait', '#ffe0a3', '#e8b04a'],
      ['unclear', '#6a6b6c', '#9c9c9d'],
      ['reduce-risk', '#ff9aab', '#f0506e'],
    ]
    for (const [mood, from, to] of palettes) {
      const html = sigilSvg({ mood, idPrefix: `p-${mood}`, animate: false })
      expect(html, mood).toContain(from)
      expect(html, mood).toContain(to)
    }
  })

  it('fogs the unclear mood and never lights its hot node', () => {
    const html = sigilSvg({ mood: 'unclear', idPrefix: 'unc', animate: false })
    expect(html).toContain('stroke-dasharray="5 7"')
    expect(html).toContain('opacity=".72"')
    expect(html).toContain('id="uncf"')
    expect(html).not.toContain('fill="#9c9c9d" stroke="#9c9c9d"')
  })

  it('lights the hot node for directional moods', () => {
    const html = sigilSvg({ mood: 'favorable', idPrefix: 'hot', animate: false })
    expect(html).toContain('fill="#ff6363" stroke="#ff6363"')
  })

  it('can render rings only', () => {
    const html = sigilSvg({ mood: 'favorable', idPrefix: 'rings', arc: false, animate: false })
    expect(html).toContain('r="470"')
    expect(html).not.toContain('A410 410')
    expect(html).not.toContain('url(#')
    expect(html).not.toContain('r="9"')
    expect(html).not.toContain('r="3"')
  })

  it('drops SMIL when animate is false', () => {
    const still = sigilSvg({ mood: 'favorable', idPrefix: 'still', animate: false })
    expect(still).not.toContain('<animate')
    const moving = sigilSvg({ mood: 'favorable', idPrefix: 'moving', animate: true })
    expect(moving).toContain('<animateTransform')
    expect(moving).toContain('<animate ')
  })

  it('keeps every def id namespaced and unique per prefix', () => {
    const first = ids(sigilSvg({ mood: 'unclear', idPrefix: 'aa', animate: false }))
    const second = ids(sigilSvg({ mood: 'unclear', idPrefix: 'bb', animate: false }))
    const all = [...first, ...second]
    expect(new Set(all).size).toBe(all.length)
    for (const element of first) expect(element.startsWith('aa')).toBe(true)
    for (const element of second) expect(element.startsWith('bb')).toBe(true)
  })

  it('scales stroke alpha with strokeBoost and caps it at 1', () => {
    const scaled = sigilSvg({ mood: 'favorable', idPrefix: 'sb', animate: false, strokeBoost: 1.9 })
    expect(scaled).toContain('rgba(255,255,255,0.266)')
    const capped = sigilSvg({ mood: 'favorable', idPrefix: 'cap', animate: false, strokeBoost: 10 })
    expect(capped).toContain('rgba(255,255,255,1.000)')
    const alphas = [...capped.matchAll(/rgba\(255,255,255,([0-9.]+)\)/g)].map((match) => Number(match[1]))
    expect(alphas.length).toBeGreaterThan(0)
    expect(Math.max(...alphas)).toBeLessThanOrEqual(1)
  })
})

describe('sealSvg', () => {
  it('draws the ring, 12 ticks and the tip at -35 degrees', () => {
    const html = sealSvg('#ff6363', 60, 'sealx')
    expect(html).toContain('data-sigil="sealx"')
    expect((html.match(/<line /g) ?? []).length).toBe(12)
    expect(html).toContain('cx="5.41" cy="-3.79"')
    expect(html).toContain('A6.6 6.6')
    expect(html).toContain('#ff6363')
  })
})

describe('dialSvg', () => {
  it('draws one arc per part and marks cash with a hatch', () => {
    const html = dialSvg(
      [
        { value: 50, color: '#8aa4ff' },
        { value: 50, color: '#9c9c9d', cash: true },
      ],
      'dialx',
    )
    expect(arcCount(html)).toBe(2)
    expect(html).toContain('id="dialxhatch"')
    expect(html).toContain('url(#dialxhatch)')
    expect(html).toContain('>50%</text>')
    expect(html).toContain('IN CASH')
  })

  it('survives an empty portfolio', () => {
    const html = dialSvg([], 'empty')
    expect(arcCount(html)).toBe(0)
    expect(html).toContain('>0%</text>')
  })
})
