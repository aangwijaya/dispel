import type { GateContract, GateStat, BinancePremium, HlAssetContext, OiPoint } from './marketData.ts'
import type {
  CandidateDerivatives,
  DerivativesFacts,
  FundingFact,
  FundingVenue,
  OiWindowChange,
} from './types.ts'

const HOUR_MS = 3_600_000
export type Coin = 'btc' | 'eth'

const VENUES: FundingVenue[] = ['binance_futures', 'gate_futures', 'hyperliquid']

export interface BinanceCoinInput {
  premium: BinancePremium
  openInterest: number
  history: OiPoint[]
}

export interface GateCoinInput {
  contract: GateContract
  stats: GateStat[]
}

export interface DerivativesInput {
  asOf: string
  binance: Partial<Record<Coin, BinanceCoinInput>>
  gate: Partial<Record<Coin, GateCoinInput>>
  hyperliquid: {
    contexts: HlAssetContext[]
    funding: Partial<Record<Coin, Array<{ time: number; rateHourly: number }>>>
  }
  priceHistory1h: Partial<Record<Coin, number[]>>
  change24hPct: Partial<Record<Coin, number>>
  previous: {
    oiUsd: Array<{ asOf: string; openInterestUsd: Partial<Record<Coin, number>> }>
    funding: Array<{ asOf: string; funding: Partial<Record<Coin, FundingFact>> }>
  }
}

function round(value: number, dp = 4): number {
  const factor = 10 ** dp
  return Math.round(value * factor) / factor
}

function pctChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return null
  return ((to - from) / from) * 100
}

function hlContext(contexts: HlAssetContext[], coin: Coin): HlAssetContext | null {
  return contexts.find((entry) => entry.coin.toUpperCase() === coin.toUpperCase()) ?? null
}

function oiUsdForCoin(input: DerivativesInput, coin: Coin): Partial<Record<FundingVenue, number>> {
  const out: Partial<Record<FundingVenue, number>> = {}
  const binance = input.binance[coin]
  if (binance) {
    const last = binance.history.at(-1)?.openInterestUsd
    const value = last ?? binance.openInterest * binance.premium.markPrice
    if (Number.isFinite(value) && value > 0) out.binance_futures = value
  }
  const gate = input.gate[coin]
  if (gate?.contract.openInterestUsd != null && gate.contract.openInterestUsd > 0) {
    out.gate_futures = gate.contract.openInterestUsd
  }
  const hl = hlContext(input.hyperliquid.contexts, coin)
  if (hl) {
    const value = hl.openInterestCoins * hl.markPx
    if (value > 0) out.hyperliquid = value
  }
  return out
}

function fundingByVenue(input: DerivativesInput, coin: Coin): Partial<Record<FundingVenue, number>> {
  const out: Partial<Record<FundingVenue, number>> = {}
  const binance = input.binance[coin]
  if (binance) out.binance_futures = round(binance.premium.lastFundingRate * 100, 4)
  const gate = input.gate[coin]
  if (gate) out.gate_futures = round(gate.contract.fundingRate8h * 100, 4)
  const hl = hlContext(input.hyperliquid.contexts, coin)
  if (hl) out.hyperliquid = round(hl.fundingHourly * 8 * 100, 4)
  return out
}

function fundingFact(input: DerivativesInput, coin: Coin): FundingFact | null {
  const byVenue = fundingByVenue(input, coin)
  const entries = Object.entries(byVenue) as Array<[FundingVenue, number]>
  if (entries.length === 0) return null

  const weights = oiUsdForCoin(input, coin)
  let weighted = 0
  let weightSum = 0
  for (const [venue, rate] of entries) {
    const weight = weights[venue] ?? 0
    weighted += rate * weight
    weightSum += weight
  }
  const current = weightSum > 0 ? weighted / weightSum : entries.reduce((total, [, rate]) => total + rate, 0) / entries.length

  // 24h average: the hourly Hyperliquid history is exact; other venues use our stored snapshots.
  const history = input.hyperliquid.funding[coin] ?? []
  let avg: number
  if (history.length >= 2) {
    const cutoff = Date.parse(input.asOf) - 24 * HOUR_MS
    const recent = history.filter((point) => point.time >= cutoff)
    const rates = (recent.length >= 2 ? recent : history.slice(-24)).map((point) => point.rateHourly * 8 * 100)
    avg = rates.reduce((total, rate) => total + rate, 0) / rates.length
  } else {
    const stored = input.previous.funding
      .filter((snapshot) => Date.parse(input.asOf) - Date.parse(snapshot.asOf) <= 24 * HOUR_MS)
      .map((snapshot) => snapshot.funding[coin]?.current_8h_pct)
      .filter((value): value is number => typeof value === 'number')
    const values = [...stored, current]
    avg = values.reduce((total, value) => total + value, 0) / values.length
  }

  return {
    current_8h_pct: round(current, 4),
    avg_24h_8h_pct: round(avg, 4),
    by_venue_8h_pct: byVenue,
  }
}

function oiWindowFromSeries(series: OiPoint[], hours: number): number | null {
  if (series.length < 2) return null
  const last = series.at(-1)
  if (!last) return null
  const target = last.time - hours * HOUR_MS
  let best: OiPoint | null = null
  for (const point of series) {
    if (best === null || Math.abs(point.time - target) < Math.abs(best.time - target)) best = point
  }
  if (!best || best === last) return null
  if (Math.abs(best.time - target) > 1.5 * HOUR_MS) return null
  return pctChange(best.openInterestUsd, last.openInterestUsd)
}

function oiWindowFromSnapshots(
  snapshots: Array<{ asOf: string; openInterestUsd: Partial<Record<Coin, number>> }>,
  coin: Coin,
  asOf: string,
  hours: number,
  currentUsd: number,
): number | null {
  const target = Date.parse(asOf) - hours * HOUR_MS
  let best: { time: number; value: number } | null = null
  for (const snapshot of snapshots) {
    const value = snapshot.openInterestUsd[coin]
    if (typeof value !== 'number') continue
    const time = Date.parse(snapshot.asOf)
    if (best === null || Math.abs(time - target) < Math.abs(best.time - target)) best = { time, value }
  }
  if (!best || Math.abs(best.time - target) > 1.5 * HOUR_MS) return null
  return pctChange(best.value, currentUsd)
}

function oiChanges(input: DerivativesInput, coin: Coin, currentUsd: number): OiWindowChange {
  const binanceSeries = input.binance[coin]?.history ?? []
  const gateSeries = (input.gate[coin]?.stats ?? []).map((stat) => ({
    time: stat.time * 1000,
    openInterestUsd: stat.openInterestUsd,
  }))
  const series = binanceSeries.length >= 2 ? binanceSeries : gateSeries
  const fromSeries = (hours: number): number | null => oiWindowFromSeries(series, hours)
  const fromSnapshots = (hours: number): number | null =>
    oiWindowFromSnapshots(input.previous.oiUsd, coin, input.asOf, hours, currentUsd)
  return {
    '1h': fromSeries(1) ?? fromSnapshots(1),
    '4h': fromSeries(4) ?? fromSnapshots(4),
    '24h': fromSeries(24) ?? fromSnapshots(24),
  }
}

function priceChanges(input: DerivativesInput, coin: Coin): OiWindowChange {
  const closes = input.priceHistory1h[coin] ?? []
  const last = closes.at(-1)
  const at = (back: number): number | null => {
    if (last === undefined) return null
    const value = closes[closes.length - 1 - back]
    return value === undefined ? null : pctChange(value, last)
  }
  return {
    '1h': at(1),
    '4h': at(4),
    '24h': at(24) ?? (input.change24hPct[coin] ?? null),
  }
}

function liquidationsFromStats(stats: GateStat[]): { long: number; short: number } | null {
  if (stats.length === 0) return null
  const last = stats.at(-1)
  if (!last) return null
  const cutoff = last.time - 24 * 3_600
  const recent = stats.filter((stat) => stat.time >= cutoff)
  return {
    long: Math.round(recent.reduce((total, stat) => total + stat.longLiqUsd, 0)),
    short: Math.round(recent.reduce((total, stat) => total + stat.shortLiqUsd, 0)),
  }
}

function liquidations(input: DerivativesInput, coin: Coin): { long: number; short: number } | null {
  return liquidationsFromStats(input.gate[coin]?.stats ?? [])
}

export function computeDerivatives(input: DerivativesInput): DerivativesFacts | null {
  const funding: DerivativesFacts['funding'] = {}
  const openInterest: DerivativesFacts['open_interest_usd'] = {}
  const oiChange: DerivativesFacts['oi_change_pct'] = {}
  const priceChange: DerivativesFacts['price_change_pct'] = {}
  const liquidations24h: DerivativesFacts['liquidations_24h_usd'] = {}
  const ratios: DerivativesFacts['long_short_account_ratio'] = {}

  for (const coin of ['btc', 'eth'] as Coin[]) {
    const fact = fundingFact(input, coin)
    if (fact) funding[coin] = fact
    const venues = oiUsdForCoin(input, coin)
    const total = Object.values(venues).reduce((sum, value) => sum + value, 0)
    if (total > 0) {
      openInterest[coin] = Math.round(total)
      oiChange[coin] = oiChanges(input, coin, total)
    }
    priceChange[coin] = priceChanges(input, coin)
    const liq = liquidations(input, coin)
    if (liq) liquidations24h[coin] = liq
    const stats = input.gate[coin]?.stats ?? []
    const ratio = stats.at(-1)?.lsrAccount
    if (ratio != null) ratios[coin] = round(ratio, 2)
  }

  if (Object.keys(openInterest).length === 0 && Object.keys(funding).length === 0) return null

  const answered: FundingVenue[] = []
  for (const venue of VENUES) {
    const hasData =
      venue === 'binance_futures'
        ? input.binance.btc !== undefined || input.binance.eth !== undefined
        : venue === 'gate_futures'
          ? input.gate.btc !== undefined || input.gate.eth !== undefined
          : input.hyperliquid.contexts.length > 0
    if (hasData) answered.push(venue)
  }

  return {
    as_of_utc: input.asOf,
    venues_answered: answered,
    venues_failed: VENUES.filter((venue) => !answered.includes(venue)),
    funding,
    open_interest_usd: openInterest,
    oi_change_pct: oiChange,
    price_change_pct: priceChange,
    liquidations_24h_usd: liquidations24h,
    long_short_account_ratio: ratios,
  }
}

export interface CandidateDerivativesInput {
  binance?: BinanceCoinInput
  gate?: GateCoinInput
  hyperliquidContext?: HlAssetContext | null
  priceHistory1h: number[]
  change24hPct: number | null
  previousOiUsd: Array<{ asOf: string; value: number }>
  asOf: string
}

export function computeCandidateDerivatives(input: CandidateDerivativesInput): CandidateDerivatives | null {
  const fundingCandidates: number[] = []
  if (input.binance) fundingCandidates.push(input.binance.premium.lastFundingRate * 100)
  if (input.gate) fundingCandidates.push(input.gate.contract.fundingRate8h * 100)
  if (input.hyperliquidContext) fundingCandidates.push(input.hyperliquidContext.fundingHourly * 8 * 100)

  const venues: Partial<Record<FundingVenue, number>> = {}
  if (input.binance) {
    venues.binance_futures = input.binance.history.at(-1)?.openInterestUsd ?? input.binance.openInterest * input.binance.premium.markPrice
  }
  if (input.gate?.contract.openInterestUsd != null) venues.gate_futures = input.gate.contract.openInterestUsd
  if (input.hyperliquidContext) {
    venues.hyperliquid = input.hyperliquidContext.openInterestCoins * input.hyperliquidContext.markPx
  }
  const totalOi = Object.values(venues).reduce((sum, value) => sum + value, 0)
  if (fundingCandidates.length === 0 && totalOi <= 0) return null

  const series =
    input.binance && input.binance.history.length >= 2
      ? input.binance.history
      : (input.gate?.stats ?? []).map((stat) => ({ time: stat.time * 1000, openInterestUsd: stat.openInterestUsd }))

  const windowFromSeries = (hours: number): number | null => {
    if (series.length < 2 || totalOi <= 0) return null
    const last = series.at(-1)
    if (!last) return null
    const target = last.time - hours * HOUR_MS
    let best: OiPoint | null = null
    for (const point of series) {
      if (best === null || Math.abs(point.time - target) < Math.abs(best.time - target)) best = point
    }
    if (!best || best === last || Math.abs(best.time - target) > 1.5 * HOUR_MS) return null
    return pctChange(best.openInterestUsd, last.openInterestUsd)
  }
  const windowFromSnapshots = (hours: number): number | null => {
    if (totalOi <= 0) return null
    const target = Date.parse(input.asOf) - hours * HOUR_MS
    let best: { time: number; value: number } | null = null
    for (const snapshot of input.previousOiUsd) {
      const time = Date.parse(snapshot.asOf)
      if (best === null || Math.abs(time - target) < Math.abs(best.time - target)) best = { time, value: snapshot.value }
    }
    if (!best || Math.abs(best.time - target) > 1.5 * HOUR_MS) return null
    return pctChange(best.value, totalOi)
  }
  const closes = input.priceHistory1h
  const lastClose = closes.at(-1)
  const price24hAgo = closes[closes.length - 25]
  const priceChange24h =
    lastClose !== undefined && price24hAgo !== undefined && price24hAgo > 0
      ? pctChange(price24hAgo, lastClose)
      : input.change24hPct

  const liq = input.gate ? liquidationsFromStats(input.gate.stats) : null

  return {
    funding_8h_pct: fundingCandidates.length > 0 ? round(fundingCandidates[0] ?? 0, 4) : null,
    oi_change_1h_pct: windowFromSeries(1) ?? windowFromSnapshots(1),
    oi_change_4h_pct: windowFromSeries(4) ?? windowFromSnapshots(4),
    oi_change_24h_pct: windowFromSeries(24) ?? windowFromSnapshots(24),
    price_change_24h_pct: priceChange24h === null || priceChange24h === undefined ? null : round(priceChange24h, 2),
    liquidations_24h_usd: liq,
    long_short_account_ratio: input.gate?.stats.at(-1)?.lsrAccount ?? null,
  }
}
