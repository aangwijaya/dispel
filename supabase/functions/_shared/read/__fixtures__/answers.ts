import type { JevAnswer, JevChoiceAnswer, JevNoulAnswer, JevResponse, JevScoreAnswer } from '../types.ts'

export function choice(value: string, confidence = 0.9, probabilities?: Record<string, number>): JevChoiceAnswer {
  return {
    type: 'choice',
    choice: value,
    confidence,
    probabilities: probabilities ?? { [value]: 1 },
  }
}

export function score(value: number, confidence = 0.8, levels = 5): JevScoreAnswer {
  const rounded = Math.round(value)
  const probabilities: Record<string, number> = {}
  const rest = levels > 1 ? (1 - confidence) / (levels - 1) : 0
  for (let i = 0; i < levels; i++) probabilities[String(i)] = i === rounded ? confidence : rest
  const legend: Record<string, string> = {}
  for (let i = 0; i < levels; i++) legend[String(i)] = `level ${i}`
  return { type: 'score', score: value, legend, probabilities, confidence }
}

export function noul(value: number): JevNoulAnswer {
  return { type: 'noul', noul: value }
}

export function makeResponse(answers: Record<string, JevAnswer>, model = 'jev-test'): JevResponse {
  return { model, answers, usage: { input_tokens: 100, output_tokens: 20 } }
}

export function marketAnswers(overrides?: {
  stance?: JevChoiceAnswer
  regime?: JevChoiceAnswer
  bias?: JevChoiceAnswer
  trend?: JevScoreAnswer
  risk?: JevScoreAnswer
}): Record<string, JevAnswer> {
  return {
    regime: overrides?.regime ?? choice('neutral', 0.8),
    stance: overrides?.stance ?? choice('favorable', 0.8),
    bias: overrides?.bias ?? choice('bullish', 0.8),
    trend_strength: overrides?.trend ?? score(3, 0.8),
    risk: overrides?.risk ?? score(1, 0.8, 3),
  }
}

export function candidateAnswers(
  symbol: string,
  input?: {
    worth?: number
    type?: string
    typeConfidence?: number
    targetFirst?: number
    riskScore?: number
  },
): Record<string, JevAnswer> {
  return {
    [`${symbol}_worth`]: noul(input?.worth ?? 0.8),
    [`${symbol}_type`]: choice(input?.type ?? 'breakout_retest', input?.typeConfidence ?? 0.8),
    [`${symbol}_target_first`]: noul(input?.targetFirst ?? 0.62),
    [`${symbol}_risk`]: score(input?.riskScore ?? 1, 0.8, 3),
  }
}
