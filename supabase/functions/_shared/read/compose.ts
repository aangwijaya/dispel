import { confidenceLevel } from './answers.ts'
import { medianAtrRatio, volatilityFromRatio } from './facts.ts'
import {
  biasLine,
  biasTone,
  biasWord,
  caution,
  decimalUtcHour,
  evidenceWells,
  explain,
  eventExchangeOutflows,
  eventFundingFlip,
  eventLevelTest,
  eventLiquidations,
  eventOiSpike,
  eventRegimeShift,
  eventSetup,
  eventVolatilityChange,
  eventVolumeSpike,
  formatClock,
  formatNumber,
  formatReadTime,
  levelNotes,
  setupBias,
  setupSees,
  setupSummary,
  shiftWhy,
  verdictFor,
} from './templates.ts'
import type {
  Candidate,
  ChangeEvent,
  ComposeInput,
  DerivativesFacts,
  MarketFacts,
  MappedSetup,
  OnchainFacts,
  PreviousInputs,
  PreviousReadSummary,
  ReadPayload,
  ReadTag,
  RegimeShift,
  RibbonSegment,
  Setup,
  VolatilityLevel,
} from './types.ts'

function clockOf(asOf: string): string {
  const parsed = Date.parse(asOf)
  return Number.isNaN(parsed) ? '00:00' : formatClock(Math.floor(parsed / 1000))
}

function uiStance(stance: ComposeInput['mapped']['stance']): ReadPayload['stance'] {
  return stance === 'reduce_risk' ? 'reduce-risk' : stance
}

function isSetupNew(mapped: MappedSetup, previous: PreviousReadSummary[]): boolean {
  const last = previous.at(-1)
  if (!last) return false
  return !last.setups.some((setup) => setup.symbol === mapped.candidate.symbol && setup.type === mapped.type)
}

function toUiSetup(mapped: MappedSetup, previous: PreviousReadSummary[]): Setup {
  const candidate = mapped.candidate
  const dp = candidate.facts.market.pricePrecision
  const bias = setupBias(mapped.type, candidate.direction)
  const notes = levelNotes(candidate, mapped.type)
  const isNew = isSetupNew(mapped, previous)
  return {
    symbol: candidate.facts.market.displayName,
    monogram: candidate.symbol,
    bias: bias.label,
    tone: bias.tone,
    ...(isNew ? { isNew: true } : {}),
    summary: setupSummary(candidate, mapped.type),
    odds: mapped.odds,
    confidence: mapped.confidence,
    risk: mapped.risk,
    horizon: candidate.horizon,
    price: formatNumber(candidate.facts.last, dp),
    changePct: Number(candidate.facts.change24h.toFixed(2)),
    sees: setupSees(candidate),
    invalidation: { value: formatNumber(candidate.invalidation, dp), note: notes.invalidation },
    target: { value: formatNumber(candidate.target, dp), note: notes.target },
    anchors: candidate.anchors,
    seed: candidate.seed,
  }
}

function toFormingSetup(candidate: Candidate): Setup {
  const dp = candidate.facts.market.pricePrecision
  const notes = levelNotes(candidate, candidate.pattern)
  return {
    symbol: candidate.facts.market.displayName,
    monogram: candidate.symbol,
    bias: 'Watching',
    tone: 'neutral',
    summary: candidate.factsText,
    odds: null,
    confidence: 0,
    risk: 1,
    horizon: candidate.horizon,
    price: formatNumber(candidate.facts.last, dp),
    changePct: Number(candidate.facts.change24h.toFixed(2)),
    condition: candidate.condition,
    sees: [],
    invalidation: { value: formatNumber(candidate.invalidation, dp), note: notes.invalidation },
    target: { value: formatNumber(candidate.target, dp), note: notes.target },
    anchors: candidate.anchors,
    seed: candidate.seed,
  }
}

function buildChanges(input: {
  asOf: string
  facts: MarketFacts[]
  mapped: ComposeInput['mapped']
  previousReads: PreviousReadSummary[]
  previousInputs: PreviousInputs[]
  derivatives: DerivativesFacts | null
  onchain: OnchainFacts | null
  volatility: VolatilityLevel
  up: number
  coverage: number
  medianRatio: number
}): ChangeEvent[] {
  const {
    asOf,
    facts,
    mapped,
    previousReads,
    previousInputs,
    derivatives,
    onchain,
    volatility,
    up,
    coverage,
    medianRatio,
  } = input
  const events: ChangeEvent[] = []
  const previous = previousReads.at(-1)
  const now = clockOf(asOf)

  if (previous && previous.regimeIndex !== mapped.regimeIndex) {
    events.push({
      ...eventRegimeShift(previous.regimeIndex, mapped.regimeIndex, shiftWhy(previous.regimeIndex, mapped.regimeIndex, up, coverage, medianRatio)),
      time: now,
    })
  }

  for (const major of facts.filter((item) => item.market.baseAsset === 'BTC' || item.market.baseAsset === 'ETH')) {
    if (major.nearestResistance !== null && (major.nearestResistance - major.last) / major.last <= 0.005) {
      events.push(eventLevelTest(major, 'resistance'))
    } else if (major.nearestSupport !== null && (major.last - major.nearestSupport) / major.last <= 0.005) {
      events.push(eventLevelTest(major, 'support'))
    }
  }

  const spikes = facts
    .filter((item) => item.volVs7dPct >= 60)
    .sort((a, b) => b.volVs7dPct - a.volVs7dPct)
    .slice(0, 2)
  for (const spike of spikes) events.push(eventVolumeSpike(spike))

  if (previous && previous.volatility !== volatility) {
    events.push({ ...eventVolatilityChange(volatility, previous.volatility), time: now })
  }

  if (previous) {
    const previousKeys = new Set(previous.setups.map((setup) => `${setup.symbol}:${setup.type}`))
    const currentKeys = new Set(mapped.setups.map((setup) => `${setup.candidate.symbol}:${setup.type}`))
    for (const setup of mapped.setups) {
      const key = `${setup.candidate.symbol}:${setup.type}`
      if (previousKeys.has(key)) continue
      events.push({ ...eventSetup('added', setup.candidate.symbol, setup.type), time: now })
    }
    for (const setup of previous.setups) {
      const key = `${setup.symbol}:${setup.type}`
      if (currentKeys.has(key)) continue
      events.push({ ...eventSetup('removed', setup.symbol, setup.type), time: now })
    }
  }

  // Derivatives events: funding sign flip, 1h OI spike, large 24h liquidations.
  const previousFunding = previousInputs.at(-1)?.derivatives?.funding
  for (const coin of ['btc', 'eth'] as const) {
    const current = derivatives?.funding[coin]
    const prior = previousFunding?.[coin]
    if (current && prior) {
      const before = Math.sign(prior.current_8h_pct)
      const after = Math.sign(current.current_8h_pct)
      if (before !== 0 && after !== 0 && before !== after) {
        events.push(eventFundingFlip(coin, prior.current_8h_pct, current.current_8h_pct, now))
      }
    }
    const oiChange = derivatives?.oi_change_pct[coin]?.['1h']
    if (oiChange != null && Math.abs(oiChange) >= 5) {
      events.push(eventOiSpike(coin, oiChange, now))
    }
    const liq = derivatives?.liquidations_24h_usd[coin]
    const threshold = coin === 'btc' ? 50_000_000 : 25_000_000
    if (liq && liq.long + liq.short >= threshold) {
      events.push(eventLiquidations(coin, liq.long, liq.short, now))
    }
  }

  // On-chain events: 3+ consecutive days of exchange outflows.
  const onchainDays = new Map<string, OnchainFacts>()
  for (const entry of previousInputs) {
    if (entry.onchain) onchainDays.set(entry.onchain.as_of_date, entry.onchain)
  }
  if (onchain) onchainDays.set(onchain.as_of_date, onchain)
  const orderedDays = [...onchainDays.values()].sort((a, b) => (a.as_of_date < b.as_of_date ? -1 : 1))
  for (const asset of ['btc', 'eth'] as const) {
    let streak = 0
    for (let index = orderedDays.length - 1; index >= 0; index--) {
      const day = orderedDays[index]
      if (!day || day[asset].netflow_ntv_today >= 0) break
      streak += 1
    }
    const latest = orderedDays.at(-1)
    if (streak >= 3 && latest) {
      events.push(eventExchangeOutflows(asset, streak, latest[asset].netflow_ntv_7d_sum, now))
    }
  }

  const seen = new Set<string>()
  return events
    .filter((event) => {
      const key = `${event.subject}:${event.text}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0))
    .slice(0, 6)
}

function buildRibbon(input: {
  previousReads: PreviousReadSummary[]
  asOf: string
  regimeIndex: number
  up: number
  coverage: number
  medianRatio: number
}): { ribbon: RibbonSegment[]; shift: RegimeShift | null } {
  const { previousReads, asOf, regimeIndex, up, coverage, medianRatio } = input
  const today = asOf.slice(0, 10)
  const points = [
    ...previousReads
      .filter((read) => read.asOf.slice(0, 10) === today)
      .sort((a, b) => (a.asOf < b.asOf ? -1 : 1))
      .map((read) => ({ hour: decimalUtcHour(read.asOf), regime: read.regimeIndex })),
    { hour: decimalUtcHour(asOf), regime: regimeIndex },
  ]

  const ribbon: RibbonSegment[] = []
  for (const point of points) {
    const last = ribbon.at(-1)
    if (last && last.regime === point.regime) {
      last.to = Math.max(last.to, point.hour)
      continue
    }
    ribbon.push({ from: point.hour, to: point.hour, regime: point.regime })
  }
  const first = ribbon[0]
  if (first && first.from === first.to) first.from = Math.max(0, first.from - 0.5)

  const lastToday = points.length >= 2 ? points[points.length - 2] : undefined
  const shift =
    lastToday && lastToday.regime !== regimeIndex
      ? {
          time: clockOf(asOf),
          from: lastToday.regime,
          to: regimeIndex,
          why: shiftWhy(lastToday.regime, regimeIndex, up, coverage, medianRatio),
        }
      : null

  return { ribbon, shift }
}

function buildTags(
  facts: MarketFacts[],
  setups: Setup[],
  forming: Setup[],
): Record<string, ReadTag> {
  const tags: Record<string, ReadTag> = {}
  for (const fact of facts) {
    const base = fact.market.baseAsset
    const setup = setups.find((item) => item.monogram === base)
    if (setup) {
      tags[base] = { label: setup.isNew ? 'Setup · new' : 'Setup', tone: 'up' }
      continue
    }
    if (forming.some((item) => item.monogram === base)) {
      tags[base] = { label: 'Forming', tone: 'neutral' }
      continue
    }
    const nearResistance =
      fact.nearestResistance !== null && (fact.nearestResistance - fact.last) / fact.last <= 0.005
    const nearSupport = fact.nearestSupport !== null && (fact.last - fact.nearestSupport) / fact.last <= 0.005
    tags[base] = nearResistance
      ? { label: 'At resistance', tone: 'caution' }
      : nearSupport
        ? { label: 'Near support', tone: 'up' }
        : { label: '—', tone: 'neutral' }
  }
  return tags
}

export function composeRead(input: ComposeInput): ReadPayload {
  const {
    asOf,
    facts,
    candidates,
    mapped,
    previousReads,
    derivatives = null,
    onchain = null,
    previousInputs = [],
  } = input
  const btc = facts.find((item) => item.market.symbol === 'BTCUSDT')
  if (!btc) throw new Error('compose requires BTC facts')

  const up = facts.filter((item) => item.change24h > 0).length
  const down = facts.length - up
  const coverage = facts.length
  const volumePct = facts.reduce((total, item) => total + item.volVs7dPct, 0) / Math.max(facts.length, 1)
  const medianRatio = medianAtrRatio(facts)
  const volatility = volatilityFromRatio(medianRatio)

  const setups = mapped.setups.map((setup) => toUiSetup(setup, previousReads))
  const forming = candidates.filter((candidate) => candidate.isForming === true).map(toFormingSetup)
  const extended = mapped.setups.filter(
    (setup) =>
      Math.abs(setup.candidate.facts.last - setup.candidate.level) >
      1.5 * setup.candidate.facts.atr4h,
  ).length
  // mapped.setups is already ordered by horizon (then symbol) in answers.ts; keep that order.
  const orderedSetups = setups

  const { ribbon, shift } = buildRibbon({
    previousReads,
    asOf,
    regimeIndex: mapped.regimeIndex,
    up,
    coverage,
    medianRatio,
  })

  const text = explain({ bias: mapped.bias, up, down, coverage, btc, volatility, volumePct })

  return {
    stance: uiStance(mapped.stance),
    verdict: verdictFor(mapped.stance, orderedSetups.length),
    bias: biasWord(mapped.bias),
    biasTone: biasTone(mapped.bias),
    biasLine: biasLine(mapped.bias, mapped.trendScore, volumePct),
    explainLead: text.lead,
    explainRest: text.rest,
    caution: caution(volatility, extended),
    time: formatReadTime(asOf),
    coverage: `${coverage} markets`,
    regimeIndex: mapped.regimeIndex,
    ribbon,
    shift,
    stats: {
      strength: Math.round((mapped.trendScore / 4) * 100),
      confidence: confidenceLevel(mapped.stanceConfidence),
      risk: Math.min(2, Math.max(0, Math.round(mapped.riskScore))) as 0 | 1 | 2,
      volatility,
    },
    evidence: evidenceWells({
      btc,
      up,
      down,
      coverage,
      volumePct,
      volatility,
      medianAtrRatio: medianRatio,
      positioning: mapped.positioning,
      onchainAlignment: mapped.onchainAlignment,
      derivatives,
      onchain,
    }),
    setups: orderedSetups,
    forming,
    changes: buildChanges({
      asOf,
      facts,
      mapped,
      previousReads,
      previousInputs,
      derivatives,
      onchain,
      volatility,
      up,
      coverage,
      medianRatio,
    }),
    breadth: { up, down },
    tags: buildTags(facts, orderedSetups, forming),
  }
}
