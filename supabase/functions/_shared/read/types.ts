import type { Candle, Market, Ticker } from '../../../../src/types/market.ts'
import type { MarketRead, ReadPayload } from '../../../../src/types/read.ts'

export type { Candle, Market, MarketRead, ReadPayload, Ticker }
export type {
  ChangeEvent,
  Confidence,
  Evidence,
  Level,
  ReadTag,
  RegimeShift,
  RibbonSegment,
  Setup,
  Tone,
} from '../../../../src/types/read.ts'

export type Pattern = 'breakout_retest' | 'range_break' | 'momentum_turn' | 'rejection_at_resistance'
export type Direction = 'long' | 'short'
export type StanceKey = 'favorable' | 'wait' | 'unclear' | 'reduce_risk'
export type RegimeKey = 'risk_off' | 'cautious' | 'neutral' | 'constructive' | 'risk_on'
export type BiasKey = 'bullish' | 'bearish' | 'mixed' | 'neutral'
export type SetupTypeKey = Pattern | 'none'
export type VolatilityLevel = 0 | 1 | 2 | 3
export type LevelIndex = 0 | 1 | 2

export interface MarketFacts {
  market: Market
  candles4h: Candle[]
  candles1h: Candle[]
  last: number
  change24h: number
  trend4h: string
  rsi1h: number
  atr4h: number
  atrRatio: number
  nearestResistance: number | null
  nearestSupport: number | null
  volVs7dPct: number
  aboveEma50: boolean
}

export interface Candidate {
  marketSymbol: string
  symbol: string
  pattern: Pattern
  direction: Direction
  level: number
  invalidation: number
  target: number
  horizon: string
  volumeRatio: number
  retests: number
  score: number
  factsText: string
  rsi15m: number | null
  anchors: number[]
  seed: number
  facts: MarketFacts
  condition?: string
  isForming?: boolean
}

export interface JevChoiceAnswer {
  type: 'choice'
  choice: string
  probabilities: Record<string, number>
  confidence: number
}

export interface JevScoreAnswer {
  type: 'score'
  score: number
  legend: Record<string, string>
  probabilities: Record<string, number>
  confidence: number
}

export interface JevNoulAnswer {
  type: 'noul'
  noul: number
}

export type JevAnswer = JevChoiceAnswer | JevScoreAnswer | JevNoulAnswer

export interface JevResponse {
  model: string
  answers: Record<string, JevAnswer>
  usage: { input_tokens: number; output_tokens: number }
}

export interface PreviousReadSummary {
  asOf: string
  regimeIndex: number
  stance: StanceKey
  volatility: VolatilityLevel
  setups: Array<{ symbol: string; type: SetupTypeKey }>
}

export interface MappedSetup {
  candidate: Candidate
  type: SetupTypeKey
  worth: number
  targetFirst: number
  odds: number
  confidence: LevelIndex
  risk: LevelIndex
}

export interface MappedRead {
  stance: StanceKey
  stanceConfidence: number
  regimeKey: RegimeKey
  regimeIndex: number
  regimeConfidence: number
  bias: BiasKey
  biasConfidence: number
  trendScore: number
  riskScore: number
  setups: MappedSetup[]
}

export interface ComposeInput {
  asOf: string
  facts: MarketFacts[]
  candidates: Candidate[]
  mapped: MappedRead
  previousReads: PreviousReadSummary[]
}

export const REGIME_KEYS: RegimeKey[] = ['risk_off', 'cautious', 'neutral', 'constructive', 'risk_on']
export const STANCE_KEYS: StanceKey[] = ['favorable', 'wait', 'unclear', 'reduce_risk']
export const BIAS_KEYS: BiasKey[] = ['bullish', 'bearish', 'mixed', 'neutral']
export const SETUP_TYPE_KEYS: SetupTypeKey[] = [
  'breakout_retest',
  'momentum_turn',
  'range_break',
  'rejection_at_resistance',
  'none',
]
