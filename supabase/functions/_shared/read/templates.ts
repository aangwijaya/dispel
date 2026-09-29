import type {
  BiasKey,
  Candidate,
  ChangeEvent,
  DerivativesFacts,
  Evidence,
  MarketFacts,
  OnchainAlignmentKey,
  OnchainFacts,
  PositioningKey,
  SetupTypeKey,
  StanceKey,
  Tone,
  VolatilityLevel,
} from './types.ts'

const VOLATILITY_LABEL = ['Low', 'Normal', 'Elevated', 'Extreme']
const REGIME_NAME = ['Risk-off', 'Cautious', 'Neutral', 'Constructive', 'Risk-on']

export function formatNumber(value: number, dp = 2): string {
  const fixed = Math.abs(value).toFixed(dp)
  const [int, frac] = fixed.split('.')
  const grouped = (int ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${value < 0 ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`
}

export function formatClock(seconds: number): string {
  const date = new Date(seconds * 1000)
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

export function formatReadTime(asOf: string): string {
  const date = new Date(asOf)
  if (Number.isNaN(date.getTime())) return '00:00 UTC'
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`
}

export function decimalUtcHour(asOf: string): number {
  const date = new Date(asOf)
  if (Number.isNaN(date.getTime())) return 0
  return date.getUTCHours() + date.getUTCMinutes() / 60
}

export function verdictFor(stance: StanceKey, setupCount: number): string {
  if (stance === 'reduce_risk') return 'Reduce risk'
  if (stance === 'wait') return 'Wait.'
  if (stance === 'unclear') return 'No clear read'
  return setupCount > 0 ? 'Look for setups' : 'Be selective'
}

export function biasWord(bias: BiasKey): string {
  if (bias === 'bullish') return 'Bullish'
  if (bias === 'bearish') return 'Bearish'
  if (bias === 'mixed') return 'Mixed'
  return 'Neutral'
}

export function biasTone(bias: BiasKey): Tone {
  if (bias === 'bullish') return 'up'
  if (bias === 'bearish') return 'down'
  if (bias === 'mixed') return 'caution'
  return 'neutral'
}

function controlWord(trendScore: number): string {
  if (trendScore < 0.75) return 'barely in control'
  if (trendScore < 1.75) return 'marginally ahead'
  if (trendScore < 2.75) return 'in moderate control'
  if (trendScore < 3.5) return 'in firm control'
  return 'in total control'
}

export function biasLine(bias: BiasKey, trendScore: number, volumePct: number): string {
  const quiet = volumePct < -15 ? ', on thin volume' : ''
  if (bias === 'bullish') return `buyers ${controlWord(trendScore)}${quiet}`
  if (bias === 'bearish') return `sellers ${controlWord(trendScore)}${quiet}`
  if (bias === 'mixed') return `both sides active${quiet}`
  return `range-bound, low participation${quiet}`
}

export function explain(input: {
  bias: BiasKey
  up: number
  down: number
  coverage: number
  btc: MarketFacts
  volatility: VolatilityLevel
  volumePct: number
}): { lead: string; rest: string } {
  const { bias, up, down, coverage, btc, volatility } = input
  const volWord = VOLATILITY_LABEL[volatility]?.toLowerCase() ?? 'normal'
  const level =
    btc.nearestResistance !== null && btc.last > btc.nearestResistance * 0.995
      ? ` just below resistance at ${formatNumber(btc.nearestResistance, btc.market.pricePrecision)}`
      : btc.nearestSupport !== null && btc.last < btc.nearestSupport * 1.005
        ? ` just above support at ${formatNumber(btc.nearestSupport, btc.market.pricePrecision)}`
        : ' mid-range'
  const volumeWord = input.volumePct < -15 ? 'below' : 'near'
  const lead =
    bias === 'bullish'
      ? `Buyers are holding an edge with ${up} of ${coverage} markets up on the day.`
      : bias === 'bearish'
        ? `Sellers are holding an edge with ${down} of ${coverage} markets down on the day.`
        : bias === 'mixed'
          ? `Direction is mixed: ${up} of ${coverage} markets are up while the majors give conflicting signals.`
          : `Price is ranging: ${up} of ${coverage} markets are up and volatility is ${volWord}.`
  const rest = `BTC trades at ${formatNumber(btc.last, btc.market.pricePrecision)}${level}, with volatility ${volWord} and volume ${volumeWord} its 7-day average.`
  return { lead, rest }
}

export function caution(volatility: VolatilityLevel, extendedSetups: number): string {
  if (volatility === 3) return 'Volatility is extreme. Ordinary-sized moves now carry unusually wide ranges.'
  if (volatility === 2) return 'Volatility is elevated. Wider swings mean wider mistakes.'
  if (extendedSetups > 0) return 'Avoid chasing extended moves. Let pullbacks prove support before acting.'
  return 'Keep the invalidation levels visible. The next read can change the picture.'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatOnchainDate(date: string): string {
  const [, month, day] = date.split('-')
  const monthIndex = Number(month) - 1
  const label = MONTHS[monthIndex] ?? month ?? ''
  return `${label} ${Number(day)}`
}

export function formatMoneyCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function signedPct(value: number, digits = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`
}

function coinLabel(coin: string): string {
  return coin.toUpperCase()
}

export function evidenceWells(input: {
  btc: MarketFacts
  up: number
  down: number
  coverage: number
  volumePct: number
  volatility: VolatilityLevel
  medianAtrRatio: number
  positioning: PositioningKey | null
  onchainAlignment: OnchainAlignmentKey | null
  derivatives: DerivativesFacts | null
  onchain: OnchainFacts | null
}): Evidence[] {
  const { btc, up, down, coverage, volumePct, volatility, medianAtrRatio, positioning, onchainAlignment } = input
  const upShare = coverage === 0 ? 0.5 : up / coverage
  const trendTone: Tone = btc.trend4h.includes('higher')
    ? 'up'
    : btc.trend4h.includes('lower')
      ? 'down'
      : 'neutral'
  const momentumTone: Tone = btc.rsi1h > 55 ? 'up' : btc.rsi1h < 45 ? 'down' : 'neutral'
  const volumeTone: Tone = volumePct > 15 ? 'up' : volumePct < -15 ? 'caution' : 'neutral'
  const breadthTone: Tone = upShare > 0.6 ? 'up' : upShare < 0.4 ? 'down' : 'neutral'
  const atResistance =
    btc.nearestResistance !== null && (btc.nearestResistance - btc.last) / btc.last <= 0.005
  const atSupport = btc.nearestSupport !== null && (btc.last - btc.nearestSupport) / btc.last <= 0.005

  return [
    {
      label: 'Trend',
      state: btc.trend4h.includes('higher') ? 'Up' : btc.trend4h.includes('lower') ? 'Down' : 'Flat',
      tone: trendTone,
      detail: `BTC 4h structure: ${btc.trend4h}`,
    },
    {
      label: 'Momentum',
      state: btc.rsi1h > 55 ? 'Firming' : btc.rsi1h < 45 ? 'Falling' : 'Neutral',
      tone: momentumTone,
      detail: `BTC 1h RSI ${btc.rsi1h.toFixed(0)}`,
    },
    {
      label: 'Volume',
      state: volumePct > 15 ? 'Above avg' : volumePct < -15 ? 'Thin' : 'Normal',
      tone: volumeTone,
      detail: `Average volume ${volumePct >= 0 ? '+' : ''}${volumePct.toFixed(0)}% versus 7 days`,
    },
    {
      label: 'Volatility',
      state: VOLATILITY_LABEL[volatility] ?? 'Normal',
      tone: volatility >= 2 ? 'caution' : 'neutral',
      detail: `ATR median ${medianAtrRatio.toFixed(2)}x its 30-day median`,
    },
    {
      label: 'Breadth',
      state: `${up} / ${coverage} up`,
      tone: breadthTone,
      detail:
        upShare > 0.6
          ? 'Participation widening'
          : upShare < 0.4
            ? `Participation narrowing, ${down} down`
            : 'Evenly split',
    },
    {
      label: 'Levels',
      state: atResistance ? 'At resistance' : atSupport ? 'At support' : 'Mid-range',
      tone: atResistance ? 'caution' : atSupport ? 'up' : 'neutral',
      detail: `BTC ${btc.nearestResistance === null ? 'no clear resistance' : formatNumber(btc.nearestResistance, btc.market.pricePrecision)} · ${btc.nearestSupport === null ? 'no clear support' : formatNumber(btc.nearestSupport, btc.market.pricePrecision)}`,
    },
    positioningWell(input.derivatives, positioning),
    onchainWell(input.onchain, onchainAlignment),
  ]
}

function positioningWell(derivatives: DerivativesFacts | null, positioning: PositioningKey | null): Evidence {
  if (derivatives === null) {
    return {
      label: 'Positioning',
      state: 'Unavailable',
      tone: 'neutral',
      detail: 'Derivatives sources did not answer this cycle',
    }
  }
  const funding = derivatives.funding.btc
  const oiChange = derivatives.oi_change_pct.btc?.['24h']
  const fundingText =
    funding === undefined
      ? 'BTC funding n/a'
      : `BTC funding ${signedPct(funding.current_8h_pct, 3)} 8h`
  const oiText = oiChange == null ? '' : ` · OI ${signedPct(oiChange, 1)} 24h`
  const detail = `${fundingText}${oiText}`
  const states: Record<PositioningKey, { state: string; tone: Tone }> = {
    crowded_long: { state: 'Crowded long', tone: 'caution' },
    crowded_short: { state: 'Crowded short', tone: 'caution' },
    building_leverage: { state: 'Leverage rising', tone: 'caution' },
    deleveraging: { state: 'Deleveraging', tone: 'neutral' },
    balanced: { state: 'Balanced', tone: 'neutral' },
  }
  const mapped = positioning === null ? { state: 'Unclear', tone: 'neutral' as Tone } : states[positioning]
  return { label: 'Positioning', state: mapped.state, tone: mapped.tone, detail }
}

function onchainWell(onchain: OnchainFacts | null, alignment: OnchainAlignmentKey | null): Evidence {
  if (onchain === null) {
    return {
      label: 'On-chain',
      state: 'Unavailable',
      tone: 'neutral',
      detail: 'Sources did not answer this cycle',
    }
  }
  const states: Record<OnchainAlignmentKey, { state: string; tone: Tone }> = {
    supports: { state: 'Supports', tone: 'up' },
    contradicts: { state: 'Contradicts', tone: 'down' },
    unclear: { state: 'Unclear', tone: 'neutral' },
  }
  const mapped = alignment === null ? states.unclear : states[alignment]
  const netflow = `${onchain.btc.netflow_ntv_7d_sum >= 0 ? '+' : ''}${formatNumber(onchain.btc.netflow_ntv_7d_sum, 0)} BTC 7d`
  const stablecoins =
    onchain.stablecoin_supply_30d_change_pct === null
      ? 'stablecoins n/a'
      : `stablecoins ${signedPct(onchain.stablecoin_supply_30d_change_pct, 1)} 30d`
  return {
    label: 'On-chain',
    state: mapped.state,
    tone: mapped.tone,
    detail: `${netflow} · ${stablecoins} · as of ${formatOnchainDate(onchain.as_of_date)}`,
  }
}

export function eventFundingFlip(coin: string, from: number, to: number, time: string): ChangeEvent {
  return {
    time,
    subject: coinLabel(coin),
    kind: 'caution',
    text: `Funding flipped ${to < 0 ? 'negative' : 'positive'} on ${coinLabel(coin)} (${signedPct(to, 3)} 8h)`,
    detail: `From ${signedPct(from, 3)}`,
  }
}

export function eventOiSpike(coin: string, changePct: number, time: string): ChangeEvent {
  return {
    time,
    subject: coinLabel(coin),
    kind: 'caution',
    text: `${coinLabel(coin)} open interest ${signedPct(changePct, 1)} in the last hour`,
    detail: 'Moves of 5% or more can precede sharp reversals',
  }
}

export function eventLiquidations(coin: string, longUsd: number, shortUsd: number, time: string): ChangeEvent {
  const dominant = longUsd >= shortUsd ? 'long' : 'short'
  return {
    time,
    subject: coinLabel(coin),
    kind: 'caution',
    text: `${coinLabel(coin)} saw ${formatMoneyCompact(longUsd + shortUsd)} of ${dominant} liquidations in 24h`,
    detail: `Long ${formatMoneyCompact(longUsd)} · Short ${formatMoneyCompact(shortUsd)}`,
  }
}

export function eventExchangeOutflows(asset: string, days: number, netflow7d: number, time: string): ChangeEvent {
  return {
    time,
    subject: coinLabel(asset),
    kind: 'info',
    text: `${coinLabel(asset)} exchange outflows for ${days} straight days`,
    detail: `7-day net ${netflow7d >= 0 ? '+' : ''}${Math.round(netflow7d)} ${coinLabel(asset)}`,
  }
}

export function setupBias(type: SetupTypeKey, direction: Candidate['direction']): { label: string; tone: Tone } {
  if (type === 'rejection_at_resistance') return { label: 'Bearish lean', tone: 'down' }
  if (type === 'momentum_turn' && direction === 'short') return { label: 'Bearish lean', tone: 'down' }
  return { label: 'Bullish', tone: 'up' }
}

export function setupSummary(candidate: Candidate, type: SetupTypeKey): string {
  const dp = candidate.facts.market.pricePrecision
  const level = formatNumber(candidate.level, dp)
  if (type === 'breakout_retest') {
    return `Pullback is holding above the ${level} breakout. Buyers defended it ${candidate.retests} time(s) on the retest.`
  }
  if (type === 'range_break') {
    return `Broke out of an 11-day range at ${level} on ${candidate.volumeRatio.toFixed(1)}x volume. Price is ${(((candidate.facts.last - candidate.level) / candidate.level) * 100).toFixed(2)}% from the level.`
  }
  if (type === 'momentum_turn') {
    const turn = candidate.direction === 'long' ? 'up' : 'down'
    return `Momentum is turning ${turn} after a base near ${level}. The level to hold is ${level}.`
  }
  return `Repeated test of the ${level} resistance. Each bounce is weaker, so rejection risk is rising.`
}

export function setupSees(candidate: Candidate): string[] {
  const dp = candidate.facts.market.pricePrecision
  const side = candidate.direction === 'long' ? 'above' : 'below'
  const rsi = candidate.rsi15m === null ? candidate.facts.rsi1h : candidate.rsi15m
  return [
    `Price is ${(((side === 'above' ? candidate.facts.last - candidate.level : candidate.level - candidate.facts.last) / candidate.level) * 100).toFixed(2)}% ${side} the ${formatNumber(candidate.level, dp)} level.`,
    `Latest 4h volume is ${candidate.volumeRatio.toFixed(1)}x the 20-candle average.`,
    `RSI is ${rsi.toFixed(0)} and the 4h structure is ${candidate.facts.trend4h}.`,
  ]
}

export function levelNotes(candidate: Candidate, type: SetupTypeKey): { invalidation: string; target: string } {
  if (type === 'breakout_retest') {
    return { invalidation: 'A close back below the breakout level.', target: 'Prior swing high above the range.' }
  }
  if (type === 'range_break') {
    return { invalidation: 'A close back inside the range.', target: 'Measured move of the range.' }
  }
  if (type === 'momentum_turn') {
    return {
      invalidation: `A close beyond the ${formatNumber(candidate.level, candidate.facts.market.pricePrecision)} level.`,
      target: 'The next structure level.',
    }
  }
  return { invalidation: 'A clean close above resistance.', target: 'The lower half of the range.' }
}

export function formingCondition(candidate: Candidate): string {
  return candidate.condition ?? 'Needs the pattern to complete before it is actionable.'
}

export function regimeName(index: number): string {
  return REGIME_NAME[index] ?? 'Neutral'
}

export function shiftWhy(from: number, to: number, up: number, coverage: number, medianAtrRatio: number): string {
  const direction = to < from ? 'weakened' : 'improved'
  return `Breadth ${up} of ${coverage} up as volatility sits at ${medianAtrRatio.toFixed(2)}x its 30-day median. The regime ${direction} from ${regimeName(from)} to ${regimeName(to)}.`
}

export function eventLevelTest(facts: MarketFacts, side: 'resistance' | 'support'): ChangeEvent {
  const dp = facts.market.pricePrecision
  const price = side === 'resistance' ? facts.nearestResistance : facts.nearestSupport
  const clock = formatClock(facts.candles4h.at(-1)?.time ?? 0)
  return {
    time: clock,
    subject: facts.market.baseAsset,
    kind: side === 'resistance' ? 'caution' : 'info',
    text:
      side === 'resistance'
        ? `${facts.market.baseAsset} is testing resistance at ${formatNumber(price ?? 0, dp)}`
        : `${facts.market.baseAsset} is testing support at ${formatNumber(price ?? 0, dp)}`,
    detail: side === 'resistance' ? 'A break above would open the next range' : 'A break below would weaken the structure',
  }
}

export function eventVolumeSpike(facts: MarketFacts): ChangeEvent {
  const clock = formatClock(facts.candles4h.at(-1)?.time ?? 0)
  const change = facts.volVs7dPct
  return {
    time: clock,
    subject: facts.market.baseAsset,
    kind: 'info',
    text: `${facts.market.baseAsset} 24h volume is ${change >= 0 ? '+' : ''}${change.toFixed(0)}% versus its 7-day average`,
    detail: 'Volume',
  }
}

export function eventRegimeShift(from: number, to: number, why: string): ChangeEvent {
  return {
    time: '',
    subject: 'Market',
    kind: 'shift',
    text: `Regime shift: ${regimeName(from)} → ${regimeName(to)}`,
    detail: why,
  }
}

export function eventSetup(kind: 'added' | 'removed', symbol: string, text: string): ChangeEvent {
  return {
    time: '',
    subject: symbol,
    kind: kind === 'added' ? 'info' : 'caution',
    text: kind === 'added' ? `Setup added: ${text}` : `Setup removed: ${text}`,
    detail: kind === 'added' ? 'New on this read' : 'No longer qualifies',
  }
}

export function eventVolatilityChange(level: VolatilityLevel, previous: VolatilityLevel): ChangeEvent {
  return {
    time: '',
    subject: 'Market',
    kind: level >= 2 ? 'caution' : 'info',
    text: `Volatility ${level > previous ? 'rose' : 'fell'} to ${VOLATILITY_LABEL[level]?.toLowerCase() ?? 'normal'}`,
    detail: `Previous level ${VOLATILITY_LABEL[previous]?.toLowerCase() ?? 'normal'}`,
  }
}
