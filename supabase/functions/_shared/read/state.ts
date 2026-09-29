import { median } from './indicators.ts'
import {
  REGIME_KEYS,
  type Candidate,
  type CandidateDerivatives,
  type DerivativesFacts,
  type MarketFacts,
  type OnchainFacts,
  type PreviousReadSummary,
  type Ticker,
} from './types.ts'

export interface JevBreadthState {
  up_24h: number
  down_24h: number
  above_ema50_4h: number
  avg_volume_vs_7d_pct: number
  median_atr_vs_30d: number
}

export interface JevMajorState {
  price: number
  change_24h_pct: number
  trend_4h: string
  rsi_1h: number
  volume_vs_7d_pct: number
  atr_vs_30d_median: number
  nearest_resistance: number | null
  nearest_support: number | null
  distance_to_resistance_pct: number | null
  distance_to_support_pct: number | null
}

export interface JevCandidateState {
  candidate_pattern: string
  pattern_facts: string
  price: number
  change_24h_pct: number
  rsi_1h: number
  rsi_15m?: number
  volume_vs_20p: number
  atr_vs_30d_median: number
  trend_4h: string
  invalidation: number
  target: number
  horizon: string
  distance_to_invalidation_pct: number
  reward_risk_ratio: number
  derivatives?: CandidateDerivatives
}

export interface JevPreviousRead {
  stance: string
  regime: string
  age_minutes: number
}

export interface JevState {
  as_of_utc: string
  universe: string
  previous_read: JevPreviousRead | null
  breadth: JevBreadthState
  btc: JevMajorState
  eth: JevMajorState
  derivatives?: DerivativesFacts
  onchain?: OnchainFacts
  candidates: Record<string, JevCandidateState>
}

function round(value: number, dp: number): number {
  const factor = 10 ** dp
  return Math.round(value * factor) / factor
}

function majorState(facts: MarketFacts): JevMajorState {
  const dp = facts.market.pricePrecision
  const { nearestResistance, nearestSupport, last } = facts
  return {
    price: round(last, dp),
    change_24h_pct: round(facts.change24h, 2),
    trend_4h: facts.trend4h,
    rsi_1h: round(facts.rsi1h, 1),
    volume_vs_7d_pct: round(facts.volVs7dPct, 1),
    atr_vs_30d_median: round(facts.atrRatio, 2),
    nearest_resistance: nearestResistance === null ? null : round(nearestResistance, dp),
    nearest_support: nearestSupport === null ? null : round(nearestSupport, dp),
    distance_to_resistance_pct: nearestResistance === null ? null : round(((nearestResistance - last) / last) * 100, 2),
    distance_to_support_pct: nearestSupport === null ? null : round(((last - nearestSupport) / last) * 100, 2),
  }
}

export function candidateState(candidate: Candidate, rsi15m: number | null): JevCandidateState {
  const facts = candidate.facts
  const market = facts.market
  const dp = market.pricePrecision
  const rewardRisk =
    Math.abs(candidate.target - facts.last) / Math.max(Math.abs(facts.last - candidate.invalidation), 1e-9)
  return {
    candidate_pattern: candidate.pattern,
    pattern_facts: candidate.factsText,
    price: round(facts.last, dp),
    change_24h_pct: round(facts.change24h, 2),
    rsi_1h: round(facts.rsi1h, 1),
    ...(rsi15m === null ? {} : { rsi_15m: round(rsi15m, 1) }),
    volume_vs_20p: round(candidate.volumeRatio, 2),
    atr_vs_30d_median: round(facts.atrRatio, 2),
    trend_4h: facts.trend4h,
    invalidation: round(candidate.invalidation, dp),
    target: round(candidate.target, dp),
    horizon: candidate.horizon,
    distance_to_invalidation_pct: round((Math.abs(facts.last - candidate.invalidation) / facts.last) * 100, 2),
    reward_risk_ratio: round(rewardRisk, 2),
    ...(candidate.derivatives ? { derivatives: candidate.derivatives } : {}),
  }
}

export function buildState(input: {
  asOf: string
  facts: MarketFacts[]
  tickers: Ticker[]
  previousRead: PreviousReadSummary | null
  candidates: Candidate[]
  rsi15mBySymbol: Record<string, number>
  derivatives?: DerivativesFacts | null
  onchain?: OnchainFacts | null
}): JevState {
  const { asOf, facts, tickers, previousRead, candidates, rsi15mBySymbol, derivatives = null, onchain = null } = input
  const btc = facts.find((item) => item.market.symbol === 'BTCUSDT')
  const eth = facts.find((item) => item.market.symbol === 'ETHUSDT')
  if (!btc || !eth) throw new Error('state requires BTC and ETH facts')

  const up = tickers.filter((ticker) => Number(ticker.changePercent) > 0).length

  return {
    as_of_utc: asOf,
    universe: `${facts.length} Binance USDT spot pairs`,
    previous_read:
      previousRead === null
        ? null
        : {
            stance: previousRead.stance,
            regime: REGIME_KEYS[previousRead.regimeIndex] ?? 'neutral',
            age_minutes: Math.max(0, Math.round((Date.parse(asOf) - Date.parse(previousRead.asOf)) / 60_000)),
          },
    breadth: {
      up_24h: up,
      down_24h: Math.max(0, tickers.length - up),
      above_ema50_4h: facts.filter((item) => item.aboveEma50).length,
      avg_volume_vs_7d_pct: round(
        facts.reduce((total, item) => total + item.volVs7dPct, 0) / Math.max(facts.length, 1),
        1,
      ),
      median_atr_vs_30d: round(median(facts.map((item) => item.atrRatio)), 2),
    },
    btc: majorState(btc),
    eth: majorState(eth),
    ...(derivatives ? { derivatives } : {}),
    ...(onchain ? { onchain } : {}),
    candidates: Object.fromEntries(
      candidates.map((candidate) => [candidate.symbol, candidateState(candidate, rsi15mBySymbol[candidate.symbol] ?? null)]),
    ),
  }
}
