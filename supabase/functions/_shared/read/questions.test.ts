import { describe, expect, it } from 'vitest'
import { MARKET_QUESTIONS, buildQuestions, candidateQuestionIds, candidateQuestions } from './questions.ts'
import { mockCandidate } from './__fixtures__/mock.ts'

describe('market questions', () => {
  it('defines the fixed market-wide set', () => {
    expect(Object.keys(MARKET_QUESTIONS).sort()).toEqual(['bias', 'regime', 'risk', 'stance', 'trend_strength'])
    expect(MARKET_QUESTIONS.regime?.type).toBe('choice')
    expect(MARKET_QUESTIONS.stance?.type).toBe('choice')
    expect(MARKET_QUESTIONS.bias?.type).toBe('choice')
    expect(MARKET_QUESTIONS.trend_strength?.type).toBe('score')
    expect(MARKET_QUESTIONS.risk?.type).toBe('score')
  })

  it('uses the agreed score levels', () => {
    const trend = MARKET_QUESTIONS.trend_strength
    const risk = MARKET_QUESTIONS.risk
    expect(Array.isArray(trend?.criteria) && trend.criteria).toHaveLength(5)
    expect(Array.isArray(risk?.criteria) && risk.criteria).toHaveLength(3)
  })

  it('points every market question at the state with backticked paths', () => {
    for (const question of Object.values(MARKET_QUESTIONS)) {
      expect(question.instructions).toContain('`')
    }
  })
})

describe('candidate questions', () => {
  it('defines the four agreed questions with a none option', () => {
    const questions = candidateQuestions('SOL')
    expect(Object.keys(questions).sort()).toEqual([
      'SOL_risk',
      'SOL_target_first',
      'SOL_type',
      'SOL_worth',
    ])
    expect(candidateQuestionIds('SOL')).toHaveLength(4)
    const type = questions.SOL_type
    expect(type?.type).toBe('choice')
    if (type?.type === 'choice') {
      expect(Object.keys(type.criteria)).toContain('none')
      expect(Object.keys(type.criteria)).toHaveLength(5)
    }
    const worth = questions.SOL_worth
    expect(worth?.type).toBe('noul')
    if (worth?.type === 'noul') {
      expect(worth.instructions).toContain('`candidates.SOL`')
    }
  })

  it('builds the full set for the selected candidates', () => {
    const questions = buildQuestions([mockCandidate('SOL', '15m-1h'), mockCandidate('LINK', '1h-4h')])
    expect(Object.keys(questions)).toHaveLength(13)
    expect(Object.keys(questions)).toContain('LINK_target_first')
  })
})
