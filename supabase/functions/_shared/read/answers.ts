import { candidateQuestionIds } from './questions.ts'
import {
  BIAS_KEYS,
  ONCHAIN_ALIGNMENT_KEYS,
  POSITIONING_KEYS,
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
  type OnchainAlignmentKey,
  type PositioningKey,
  type RegimeKey,
  type SetupTypeKey,
  type StanceKey,
  type StanceShare,
} from './types.ts'

export const WORTH_THRESHOLD = 0.6
export const MAX_SETUPS = 5
export const ODDS_MIN = 5
export const ODDS_MAX = 95
export const CONFIDENCE_FLOOR = 0.5
// Risk is published as the highest level at least this likely to be reached, so a split
// between medium and high reads as high instead of averaging down to medium.
export const RISK_TAIL = 0.4
// A degraded read may only reuse answers from an ok read this recent (cron runs every 15 min).
export const FALLBACK_MAX_AGE_MS = 45 * 60_000

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

function asPositioning(value: string): PositioningKey | null {
  return (POSITIONING_KEYS as string[]).includes(value) ? (value as PositioningKey) : null
}

function asOnchainAlignment(value: string): OnchainAlignmentKey | null {
  return (ONCHAIN_ALIGNMENT_KEYS as string[]).includes(value) ? (value as OnchainAlignmentKey) : null
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
  if (answer.confidence >= CONFIDENCE_FLOOR) return clamp(choiceIndex, 0, 4)
  const expected = REGIME_KEYS.reduce(
    (total, key, index) => total + (answer.probabilities[key] ?? 0) * index,
    0,
  )
  return clamp(Math.round(expected), 0, 4)
}

export function riskLevel(answer: JevScoreAnswer): LevelIndex {
  let level = 0
  let atOrAbove = 0
  for (let index = 2; index >= 0; index--) {
    atOrAbove += answer.probabilities[String(index)] ?? 0
    if (atOrAbove >= RISK_TAIL) {
      level = index
      break
    }
  }
  if (atOrAbove === 0) level = Math.round(answer.score)
  return clamp(level, 0, 2) as LevelIndex
}

/** Percent chance of the published risk level or higher, when it sits above the most likely level. */
export function riskRaisedPct(answer: JevScoreAnswer): number | null {
  const level = riskLevel(answer)
  let peak = 0
  let atOrAbove = 0
  for (let index = 0; index <= 2; index++) {
    const probability = answer.probabilities[String(index)] ?? 0
    if (probability > (answer.probabilities[String(peak)] ?? 0)) peak = index
    if (index >= level) atOrAbove += probability
  }
  return level > peak ? Math.round(atOrAbove * 100) : null
}

/** The two most likely stances, most likely first. */
export function stanceSplit(answer: JevChoiceAnswer): StanceShare[] {
  return STANCE_KEYS.map((stance) => ({ stance, p: answer.probabilities[stance] ?? 0 }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 2)
}

export function freshFallback<T extends { as_of: string; status: string }>(rows: T[], asOf: string): T | null {
  const lastOk = rows.find((row) => row.status === 'ok')
  if (!lastOk) return null
  const age = Date.parse(asOf) - Date.parse(lastOk.as_of)
  return age >= 0 && age <= FALLBACK_MAX_AGE_MS ? lastOk : null
}

function horizonRank(horizon: string): number {
  if (horizon === '15m-1h') return 0
  if (horizon === '1h-4h') return 1
  return 2
}

export function mapAnswers(response: JevResponse, candidates: Candidate[]): MappedRead {
  const stanceAnswer = requireChoice(response, 'stance')
  const stance: StanceKey =
    stanceAnswer.confidence < CONFIDENCE_FLOOR ? 'unclear' : asStance(stanceAnswer.choice)

  const regimeAnswer = requireChoice(response, 'regime')
  const regimeKey = asRegime(regimeAnswer.choice) ?? 'neutral'
  const regimeIndex = regimeIndexFromAnswer(regimeAnswer)

  const biasAnswer = requireChoice(response, 'bias')
  const bias: BiasKey = biasAnswer.confidence < CONFIDENCE_FLOOR ? 'mixed' : asBias(biasAnswer.choice)
  const trendAnswer = requireScore(response, 'trend_strength')
  const riskAnswer = requireScore(response, 'risk')

  const positioningAnswer = response.answers.positioning
  const positioning =
    positioningAnswer?.type === 'choice' && positioningAnswer.confidence >= CONFIDENCE_FLOOR
      ? asPositioning(positioningAnswer.choice)
      : null
  const onchainAnswer = response.answers.onchain_alignment
  const onchainAlignment =
    onchainAnswer?.type === 'choice' && onchainAnswer.confidence >= CONFIDENCE_FLOOR
      ? asOnchainAlignment(onchainAnswer.choice)
      : null

  const setups: MappedSetup[] = []
  for (const candidate of candidates) {
    const [worthId, typeId, targetId, riskId] = candidateQuestionIds(candidate.symbol)
    if (!worthId || !typeId || !targetId || !riskId) continue
    const worth = requireNoul(response, worthId).noul
    const typeAnswer = requireChoice(response, typeId)
    const type = asSetupType(typeAnswer.choice)
    const targetFirst = requireNoul(response, targetId).noul
    const risk = riskLevel(requireScore(response, riskId))
    if (worth < WORTH_THRESHOLD || type === 'none') continue
    setups.push({
      candidate,
      type,
      worth,
      targetFirst,
      odds: clamp(Math.round(targetFirst * 100), ODDS_MIN, ODDS_MAX),
      confidence: confidenceLevel(typeAnswer.confidence),
      risk,
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
    stanceSplit: stanceSplit(stanceAnswer),
    regimeKey,
    regimeIndex,
    regimeConfidence: regimeAnswer.confidence,
    bias,
    biasConfidence: biasAnswer.confidence,
    trendScore: clamp(trendAnswer.score, 0, 4),
    risk: riskLevel(riskAnswer),
    riskRaisedPct: riskRaisedPct(riskAnswer),
    setups: setups.slice(0, MAX_SETUPS),
    positioning,
    onchainAlignment,
  }
}
