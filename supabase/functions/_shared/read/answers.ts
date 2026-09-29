import { candidateQuestionIds } from './questions.ts'
import {
  BIAS_KEYS,
  REGIME_KEYS,
  SETUP_TYPE_KEYS,
  STANCE_KEYS,
  type BiasKey,
  type Candidate,
  type JevAnswer,
  type JevChoiceAnswer,
  type JevNoulAnswer,
  type JevResponse,
  type JevScoreAnswer,
  type LevelIndex,
  type MappedRead,
  type MappedSetup,
  type RegimeKey,
  type SetupTypeKey,
  type StanceKey,
} from './types.ts'

export const WORTH_THRESHOLD = 0.6
export const MAX_SETUPS = 5
export const ODDS_MIN = 5
export const ODDS_MAX = 95
export const STANCE_CONFIDENCE_FLOOR = 0.5

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseAnswer(value: unknown): JevAnswer | null {
  if (!isRecord(value)) return null
  if (value.type === 'noul') {
    return isFiniteNumber(value.noul) && value.noul >= 0 && value.noul <= 1 ? { type: 'noul', noul: value.noul } : null
  }
  if (!isRecord(value.probabilities) || !isFiniteNumber(value.confidence)) return null
  const probabilities: Record<string, number> = {}
  for (const [key, probability] of Object.entries(value.probabilities)) {
    if (!isFiniteNumber(probability)) return null
    probabilities[key] = probability
  }
  if (value.confidence < 0 || value.confidence > 1) return null
  if (value.type === 'choice') {
    if (typeof value.choice !== 'string') return null
    return { type: 'choice', choice: value.choice, probabilities, confidence: value.confidence }
  }
  if (value.type === 'score') {
    if (!isFiniteNumber(value.score) || !isRecord(value.legend)) return null
    const legend: Record<string, string> = {}
    for (const [key, text] of Object.entries(value.legend)) {
      if (typeof text !== 'string') return null
      legend[key] = text
    }
    return { type: 'score', score: value.score, legend, probabilities, confidence: value.confidence }
  }
  return null
}

export function parseJevResponse(raw: unknown): JevResponse {
  if (!isRecord(raw)) throw new Error('invalid_jev_response: not an object')
  if (typeof raw.model !== 'string' || raw.model === '') throw new Error('invalid_jev_response: missing model')
  if (!isRecord(raw.answers)) throw new Error('invalid_jev_response: missing answers')
  if (!isRecord(raw.usage) || !isFiniteNumber(raw.usage.input_tokens) || !isFiniteNumber(raw.usage.output_tokens)) {
    throw new Error('invalid_jev_response: missing usage')
  }
  const answers: Record<string, JevAnswer> = {}
  for (const [id, value] of Object.entries(raw.answers)) {
    const answer = parseAnswer(value)
    if (!answer) throw new Error(`invalid_jev_response: bad answer "${id}"`)
    answers[id] = answer
  }
  return {
    model: raw.model,
    answers,
    usage: { input_tokens: raw.usage.input_tokens, output_tokens: raw.usage.output_tokens },
  }
}

function requireChoice(response: JevResponse, id: string): JevChoiceAnswer {
  const answer = response.answers[id]
  if (!answer || answer.type !== 'choice') throw new Error(`invalid_jev_response: missing choice "${id}"`)
  return answer
}

function requireNoul(response: JevResponse, id: string): JevNoulAnswer {
  const answer = response.answers[id]
  if (!answer || answer.type !== 'noul') throw new Error(`invalid_jev_response: missing noul "${id}"`)
  return answer
}

function requireScore(response: JevResponse, id: string): JevScoreAnswer {
  const answer = response.answers[id]
  if (!answer || answer.type !== 'score') throw new Error(`invalid_jev_response: missing score "${id}"`)
  return answer
}

function asStance(value: string): StanceKey {
  return (STANCE_KEYS as string[]).includes(value) ? (value as StanceKey) : 'unclear'
}

function asBias(value: string): BiasKey {
  return (BIAS_KEYS as string[]).includes(value) ? (value as BiasKey) : 'mixed'
}

function asRegime(value: string): RegimeKey | null {
  return (REGIME_KEYS as string[]).includes(value) ? (value as RegimeKey) : null
}

function asSetupType(value: string): SetupTypeKey {
  return (SETUP_TYPE_KEYS as string[]).includes(value) ? (value as SetupTypeKey) : 'none'
}

export function confidenceLevel(confidence: number): LevelIndex {
  if (confidence < 0.5) return 0
  if (confidence <= 0.9) return 1
  return 2
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function regimeIndexFromAnswer(answer: JevChoiceAnswer): number {
  const choice = asRegime(answer.choice)
  const choiceIndex = choice === null ? 2 : REGIME_KEYS.indexOf(choice)
  if (answer.confidence >= STANCE_CONFIDENCE_FLOOR) return clamp(choiceIndex, 0, 4)
  const expected = REGIME_KEYS.reduce(
    (total, key, index) => total + (answer.probabilities[key] ?? 0) * index,
    0,
  )
  return clamp(Math.round(expected), 0, 4)
}

function horizonRank(horizon: string): number {
  if (horizon === '15m-1h') return 0
  if (horizon === '1h-4h') return 1
  return 2
}

export function mapAnswers(response: JevResponse, candidates: Candidate[]): MappedRead {
  const stanceAnswer = requireChoice(response, 'stance')
  const stance: StanceKey =
    stanceAnswer.confidence < STANCE_CONFIDENCE_FLOOR ? 'unclear' : asStance(stanceAnswer.choice)

  const regimeAnswer = requireChoice(response, 'regime')
  const regimeKey = asRegime(regimeAnswer.choice) ?? 'neutral'
  const regimeIndex = regimeIndexFromAnswer(regimeAnswer)

  const biasAnswer = requireChoice(response, 'bias')
  const trendAnswer = requireScore(response, 'trend_strength')
  const riskAnswer = requireScore(response, 'risk')

  const setups: MappedSetup[] = []
  for (const candidate of candidates) {
    const [worthId, typeId, targetId, riskId] = candidateQuestionIds(candidate.symbol)
    if (!worthId || !typeId || !targetId || !riskId) continue
    const worth = requireNoul(response, worthId).noul
    const typeAnswer = requireChoice(response, typeId)
    const type = asSetupType(typeAnswer.choice)
    const targetFirst = requireNoul(response, targetId).noul
    const riskScore = requireScore(response, riskId).score
    if (worth < WORTH_THRESHOLD || type === 'none') continue
    setups.push({
      candidate,
      type,
      worth,
      targetFirst,
      odds: clamp(Math.round(targetFirst * 100), ODDS_MIN, ODDS_MAX),
      confidence: confidenceLevel(typeAnswer.confidence),
      risk: clamp(Math.round(riskScore), 0, 2) as LevelIndex,
    })
  }

  setups.sort((a, b) => {
    const rank = horizonRank(a.candidate.horizon) - horizonRank(b.candidate.horizon)
    if (rank !== 0) return rank
    return a.candidate.symbol.localeCompare(b.candidate.symbol)
  })

  return {
    stance,
    stanceConfidence: stanceAnswer.confidence,
    regimeKey,
    regimeIndex,
    regimeConfidence: regimeAnswer.confidence,
    bias: asBias(biasAnswer.choice),
    biasConfidence: biasAnswer.confidence,
    trendScore: clamp(trendAnswer.score, 0, 4),
    riskScore: clamp(riskAnswer.score, 0, 4),
    setups: setups.slice(0, MAX_SETUPS),
  }
}
