import { describe, expect, it } from 'vitest'
import { confidenceLevel, mapAnswers, parseJevResponse } from './answers.ts'
import { SPIKE_ANSWERS } from './__fixtures__/spike-answers.ts'
import { candidateAnswers, choice, makeResponse, marketAnswers } from './__fixtures__/answers.ts'
import { mockCandidate } from './__fixtures__/mock.ts'
import type { Candidate } from './types.ts'

function candidates(...list: Array<[string, string]>): Candidate[] {
  return list.map(([symbol, horizon]) => mockCandidate(symbol, horizon))
}

describe('parseJevResponse', () => {
  it('accepts the recorded spike response', () => {
    const parsed = parseJevResponse(SPIKE_ANSWERS)
    expect(parsed.model).toBe('jev-1.13.0')
    expect(parsed.usage.input_tokens).toBe(2184)
    expect(parsed.answers.stance?.type).toBe('choice')
  })

  it('rejects malformed payloads', () => {
    expect(() => parseJevResponse(null)).toThrow('invalid_jev_response')
    expect(() => parseJevResponse({ model: 'x', answers: {}, usage: {} })).toThrow('invalid_jev_response')
    expect(() =>
      parseJevResponse({ model: 'x', answers: { a: { type: 'noul', noul: 2 } }, usage: { input_tokens: 1, output_tokens: 1 } }),
    ).toThrow('invalid_jev_response: bad answer "a"')
  })
})

describe('confidenceLevel', () => {
  it('maps confidence bands to UI levels', () => {
    expect(confidenceLevel(0.2)).toBe(0)
    expect(confidenceLevel(0.5)).toBe(1)
    expect(confidenceLevel(0.9)).toBe(1)
    expect(confidenceLevel(0.95)).toBe(2)
  })
})

describe('mapAnswers', () => {
  it('publishes unclear when stance confidence is below the floor', () => {
    const response = makeResponse(marketAnswers({ stance: choice('favorable', 0.3) }))
    const mapped = mapAnswers(response, [])
    expect(mapped.stance).toBe('unclear')
  })

  it('uses the expected step when regime confidence is low', () => {
    const response = makeResponse(
      marketAnswers({
        regime: choice('cautious', 0.27, { cautious: 0.41, risk_off: 0, neutral: 0.23, risk_on: 0.05, constructive: 0.31 }),
      }),
    )
    const mapped = mapAnswers(response, [])
    expect(mapped.regimeIndex).toBe(2)
  })

  it('uses the choice when regime confidence is high', () => {
    const response = makeResponse(marketAnswers({ regime: choice('risk_on', 0.8) }))
    expect(mapAnswers(response, []).regimeIndex).toBe(4)
  })

  it('drops candidates below the worth threshold or typed none', () => {
    const response = makeResponse({
      ...marketAnswers(),
      ...candidateAnswers('SOL', { worth: 0.52 }),
      ...candidateAnswers('LINK', { type: 'none', worth: 0.9 }),
    })
    const mapped = mapAnswers(response, candidates(['SOL', '15m-1h'], ['LINK', '15m-1h']))
    expect(mapped.setups).toHaveLength(0)
  })

  it('orders by horizon then symbol, never by odds', () => {
    const response = makeResponse({
      ...marketAnswers(),
      ...candidateAnswers('LINK', { type: 'momentum_turn' }),
      ...candidateAnswers('XRP', { targetFirst: 0.9 }),
      ...candidateAnswers('ADA', { targetFirst: 0.4 }),
    })
    const mapped = mapAnswers(response, candidates(['LINK', '1h-4h'], ['XRP', '15m-1h'], ['ADA', '15m-1h']))
    expect(mapped.setups.map((setup) => setup.candidate.symbol)).toEqual(['ADA', 'XRP', 'LINK'])
  })

  it('clamps odds and maps confidence and risk', () => {
    const response = makeResponse({
      ...marketAnswers(),
      ...candidateAnswers('SOL', { targetFirst: 0.99, typeConfidence: 0.95, riskScore: 1.6 }),
      ...candidateAnswers('LINK', { targetFirst: 0.0, typeConfidence: 0.4, riskScore: 0.2 }),
    })
    const mapped = mapAnswers(response, candidates(['SOL', '15m-1h'], ['LINK', '15m-1h']))
    const sol = mapped.setups.find((setup) => setup.candidate.symbol === 'SOL')
    const link = mapped.setups.find((setup) => setup.candidate.symbol === 'LINK')
    expect(sol?.odds).toBe(95)
    expect(sol?.confidence).toBe(2)
    expect(sol?.risk).toBe(2)
    expect(link?.odds).toBe(5)
    expect(link?.confidence).toBe(0)
    expect(link?.risk).toBe(0)
  })

  it('caps the published list at five', () => {
    const symbols = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA']
    const answers = marketAnswers()
    for (const symbol of symbols) Object.assign(answers, candidateAnswers(symbol))
    const mapped = mapAnswers(
      makeResponse(answers),
      symbols.map((symbol) => mockCandidate(symbol, '15m-1h')),
    )
    expect(mapped.setups).toHaveLength(5)
  })

  it('reads the recorded spike answers', () => {
    const mapped = mapAnswers(
      parseJevResponse(SPIKE_ANSWERS),
      [mockCandidate('XRP', '1h-4h', { pattern: 'momentum_turn' })],
    )
    expect(mapped.stance).toBe('wait')
    expect(mapped.bias).toBe('bullish')
    expect(mapped.regimeIndex).toBe(2)
    expect(mapped.trendScore).toBeCloseTo(0.83, 2)
    expect(mapped.setups).toHaveLength(0)
  })
})
