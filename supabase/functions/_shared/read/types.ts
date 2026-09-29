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
export type PositioningKey = 'crowded_long' | 'crowded_short' | 'building_leverage' | 'deleveraging' | 'balanced'
export type OnchainAlignmentKey = 'supports' | 'contradicts' | 'unclear'
export type FundingVenue = 'binance_futures' | 'gate_futures' | 'hyperliquid'

export interface FundingFact {
  current_8h_pct: number
  avg_24h_8h_pct: number
  by_venue_8h_pct: Partial<Record<FundingVenue, number>>
}

export interface OiWindowChange {
  '1h': number | null
  '4h': number | null
  '24h': number | null
}

export interface DerivativesFacts {
  as_of_utc: string
  venues_answered: FundingVenue[]
  venues_failed: FundingVenue[]
  funding: Partial<Record<'btc' | 'eth', FundingFact>>
  open_interest_usd: Partial<Record<'btc' | 'eth', number>>
  oi_change_pct: Partial<Record<'btc' | 'eth', OiWindowChange>>
  price_change_pct: Partial<Record<'btc' | 'eth', OiWindowChange>>
  liquidations_24h_usd: Partial<Record<'btc' | 'eth', { long: number; short: number }>>
  long_short_account_ratio: Partial<Record<'btc' | 'eth', number>>
}

export interface CandidateDerivatives {
  funding_8h_pct: number | null
  oi_change_1h_pct: number | null
  oi_change_4h_pct: number | null
  oi_change_24h_pct: number | null
  price_change_24h_pct: number | null
  liquidations_24h_usd: { long: number; short: number } | null
  long_short_account_ratio: number | null
}

export interface OnchainAssetFacts {
  netflow_ntv_today: number
  netflow_ntv_7d_sum: number
  netflow_today_vs_30d_avg_pct: number | null
  exchange_supply_30d_change_pct: number | null
  active_addresses_vs_30d_avg_pct: number | null
}

export interface OnchainFacts {
  as_of_date: string
  btc: OnchainAssetFacts
  eth: OnchainAssetFacts
  stablecoin_supply_usd: number | null
  stablecoin_supply_7d_change_pct: number | null
  stablecoin_supply_30d_change_pct: number | null
  btc_mempool: { tx_count: number; fastest_fee_sat_vb: number; fastest_fee_vs_7d_median_pct: number | null } | null
}

export interface SourceHealth {
  ok: boolean
  error?: string
}

export type InputsHealth = Record<string, SourceHealth>

export interface PreviousInputs {
  asOf: string
  derivatives: DerivativesFacts | null
  onchain: OnchainFacts | null
}

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
  derivatives?: CandidateDerivatives | null
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
  positioning: PositioningKey | null
  onchainAlignment: OnchainAlignmentKey | null
}

export interface ComposeInput {
  asOf: string
  facts: MarketFacts[]
  candidates: Candidate[]
  mapped: MappedRead
  previousReads: PreviousReadSummary[]
  derivatives?: DerivativesFacts | null
  onchain?: OnchainFacts | null
  previousInputs?: PreviousInputs[]
}

export const REGIME_KEYS: RegimeKey[] = ['risk_off', 'cautious', 'neutral', 'constructive', 'risk_on']
export const STANCE_KEYS: StanceKey[] = ['favorable', 'wait', 'unclear', 'reduce_risk']
export const BIAS_KEYS: BiasKey[] = ['bullish', 'bearish', 'mixed', 'neutral']
export const POSITIONING_KEYS: PositioningKey[] = [
  'crowded_long',
  'crowded_short',
  'building_leverage',
  'deleveraging',
  'balanced',
]
export const ONCHAIN_ALIGNMENT_KEYS: OnchainAlignmentKey[] = ['supports', 'contradicts', 'unclear']
export const SETUP_TYPE_KEYS: SetupTypeKey[] = [
  'breakout_retest',
  'momentum_turn',
  'range_break',
  'rejection_at_resistance',
  'none',
]
