export type Stance = 'favorable' | 'wait' | 'unclear' | 'reduce-risk'

export type Tone = 'up' | 'down' | 'caution' | 'neutral'

export type Confidence = 0 | 1 | 2

export type RiskLevel = 0 | 1 | 2

export type Volatility = 0 | 1 | 2 | 3

export interface Regime {
  name: string
  color: string
}

export interface ReadStats {
  strength: number
  confidence: Confidence
  risk: RiskLevel
  volatility: Volatility
}

export interface Evidence {
  label: string
  state: string
  tone: Tone
  detail: string
}

export interface RibbonSegment {
  from: number
  to: number
  regime: number
}

export interface RegimeShift {
  time: string
  from: number
  to: number
  why: string
}

export interface Level {
  value: string
  note: string
}

export interface Setup {
  symbol: string
  monogram: string
  bias: string
  tone: Tone
  isNew?: boolean
  summary: string
  odds: number | null
  confidence: Confidence
  risk: RiskLevel
  horizon: string
  price: string
  changePct: number
  condition?: string
  sees: string[]
  invalidation: Level
  target: Level
  anchors: number[]
  seed: number
}

export interface Exposure {
  symbol: string
  monogram: string
  status: string
  tone: Tone
  holding: string
  entry: string
  price: string
  changePct: number
  plPct: number
  cushionPct: number | null
  summary: string
  sees: string[]
  invalidation: Level
  target: Level
  anchors: number[]
  seed: number
}

export interface ChangeEvent {
  time: string
  subject: string
  kind: 'info' | 'caution' | 'shift'
  text: string
  detail: string
}

export interface SinceRow {
  kind: 'chg' | 'same' | 'new' | 'end'
  label: string
  text: string
}

export interface ReadTag {
  label: string
  tone: Tone
}

export interface MarketRead {
  stance: Stance
  verdict: string
  bias: string
  biasTone: Tone
  biasLine: string
  explainLead: string
  explainRest: string
  caution: string
  time: string
  coverage: string
  regimeIndex: number
  ribbon: RibbonSegment[]
  shift: RegimeShift | null
  stats: ReadStats
  evidence: Evidence[]
  setups: Setup[]
  forming: Setup[]
  exposure: Exposure[]
  changes: ChangeEvent[]
  since: SinceRow[]
  breadth: { up: number; down: number }
  tags: Record<string, ReadTag>
}
