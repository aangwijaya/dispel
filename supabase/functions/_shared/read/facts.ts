import { ema, rsi } from '../../../../src/lib/market/indicators.ts'
import {
  anchorsFrom,
  atrSeries,
  median,
  seedFrom,
  swings,
  trendLabel,
  volumeRatio,
} from './indicators.ts'
import type { Candidate, Candle, Market, MarketFacts, Ticker, VolatilityLevel } from './types.ts'

export function analyze(market: Market, candles4h: Candle[], candles1h: Candle[], ticker: Ticker): MarketFacts {
  const closes4h = candles4h.map((candle) => candle.close)
  const closes1h = candles1h.map((candle) => candle.close)
  const last = candles4h.at(-1)?.close ?? Number(ticker.lastPrice)
  const ema50 = ema(closes4h, 50)
  const rsi1h = rsi(closes1h).at(-1) ?? 50
  const atr = atrSeries(candles4h)
  const atrLast = atr.at(-1) ?? 0
  const atrWindow = atr.filter((value) => value > 0)
  const atrRatio = atrLast > 0 ? atrLast / (median(atrWindow) || atrLast) : 1
  const { highs, lows } = swings(candles4h, 2)
  const nearestResistance =
    highs
      .filter((price) => price > last * 1.0005)
      .sort((a, b) => a - b)[0] ?? null
  const nearestSupport =
    lows
      .filter((price) => price < last * 0.9995)
      .sort((a, b) => b - a)[0] ?? null

  let volVs7dPct = 0
  if (candles4h.length >= 48) {
    const last24h = candles4h.slice(-6).reduce((total, candle) => total + candle.volume, 0)
    const prior7d = candles4h.slice(-48, -6)
    const avg24h = prior7d.reduce((total, candle) => total + candle.volume, 0) / 7
    if (avg24h > 0) volVs7dPct = (last24h / avg24h - 1) * 100
  }

  return {
    market,
    candles4h,
    candles1h,
    last,
    change24h: Number(ticker.changePercent),
    trend4h: trendLabel(highs, lows),
    rsi1h,
    atr4h: atrLast,
    atrRatio,
    nearestResistance,
    nearestSupport,
    volVs7dPct,
    aboveEma50: last > (ema50.at(-1) ?? last),
  }
}

export function volatilityFromRatio(ratio: number): VolatilityLevel {
  if (ratio < 0.8) return 0
  if (ratio < 1.4) return 1
  if (ratio < 2.2) return 2
  return 3
}


export function prescreen(facts: MarketFacts): Candidate | null {
  const { candles4h, last, atr4h, market } = facts
  if (candles4h.length < 74 || atr4h <= 0) return null

  // The range is measured before the breakout window, so a breakout can exceed it.
  const preWindow = candles4h.slice(-74, -8)
  if (preWindow.length < 66) return null
  const rangeHigh = Math.max(...preWindow.map((candle) => candle.high))
  const rangeLow = Math.min(...preWindow.map((candle) => candle.low))
  const rangeHeight = rangeHigh - rangeLow
  if (!(rangeHeight > 0)) return null
  const dp = market.pricePrecision
  const volRatio = volumeRatio(candles4h)
  const recent = candles4h.slice(-8)
  const breakoutOffset = recent.findIndex((candle) => candle.close > rangeHigh)
  const breakoutIndex = breakoutOffset < 0 ? -1 : candles4h.length - 8 + breakoutOffset

  const drafts: Candidate[] = []

  if (breakoutIndex >= 0) {
    const after = candles4h.slice(breakoutIndex + 1)
    const retests = after.filter((candle) => candle.low <= rangeHigh * 1.005 && candle.close > rangeHigh).length
    if (retests >= 1) {
      const lowestAfter = Math.min(...after.map((candle) => candle.low), rangeHigh)
      const invalidation = lowestAfter - 0.3 * atr4h
      const target = rangeHigh + 0.75 * rangeHeight
      const rr = Math.abs(target - last) / Math.max(Math.abs(last - invalidation), atr4h * 0.1)
      const trendUp = facts.trend4h.includes('higher highs')
      const score =
        (volRatio >= 1.2 ? 1 : 0) +
        (retests >= 1 ? 1 : 0) +
        (trendUp ? 1 : 0) +
        (facts.rsi1h > 52 ? 1 : 0) +
        (rr >= 1.5 ? 1 : 0) +
        (last <= rangeHigh + 1.5 * atr4h ? 1 : 0)
      drafts.push({
        marketSymbol: market.symbol,
        symbol: market.baseAsset,
        pattern: 'breakout_retest',
        direction: 'long',
        level: rangeHigh,
        invalidation,
        target,
        horizon: '15m-1h',
        volumeRatio: volRatio,
        retests,
        score,
        factsText: `Broke the ${rangeHigh.toFixed(dp)} range high ${candles4h.length - 1 - breakoutIndex} candles ago on ${volRatio.toFixed(1)}x volume; the retest held ${retests} time(s) with the lowest low at ${lowestAfter.toFixed(dp)}; price is ${(((last - rangeHigh) / rangeHigh) * 100).toFixed(2)}% above the level.`,
        rsi15m: null,
        anchors: anchorsFrom(candles4h),
        seed: seedFrom(market.symbol),
        facts,
      })
    }
    if (retests === 0 && volRatio >= 1.5 && last > rangeHigh) {
      const invalidation = rangeHigh - 0.5 * atr4h
      const target = rangeHigh + rangeHeight
      const rr = Math.abs(target - last) / Math.max(Math.abs(last - invalidation), atr4h * 0.1)
      drafts.push({
        marketSymbol: market.symbol,
        symbol: market.baseAsset,
        pattern: 'range_break',
        direction: 'long',
        level: rangeHigh,
        invalidation,
        target,
        horizon: '15m-1h',
        volumeRatio: volRatio,
        retests: 0,
        score: 2 + (volRatio >= 2 ? 1 : 0) + (rr >= 1.5 ? 1 : 0),
        factsText: `Closed ${(((last - rangeHigh) / rangeHigh) * 100).toFixed(2)}% above the ${rangeHigh.toFixed(dp)} boundary of an 11-day range on ${volRatio.toFixed(1)}x volume; the range height is ${((rangeHeight / last) * 100).toFixed(2)}% of price.`,
        rsi15m: null,
        anchors: anchorsFrom(candles4h),
        seed: seedFrom(market.symbol),
        facts,
      })
    }
  }

  const rsi1hSeries = rsi(facts.candles1h.map((candle) => candle.close))
  const rsiWindow = rsi1hSeries.slice(-7).map((value) => value ?? 50)
  const currentRsi = rsiWindow.at(-1) ?? 50
  const crossedUp =
    currentRsi >= 50 &&
    rsiWindow.some((value, index) => index > 0 && (rsiWindow[index - 1] ?? 50) < 50 && value >= 50)
  const crossedDown =
    currentRsi <= 50 &&
    rsiWindow.some((value, index) => index > 0 && (rsiWindow[index - 1] ?? 50) > 50 && value <= 50)
  if (crossedUp || crossedDown) {
    const direction = crossedUp ? ('long' as const) : ('short' as const)
    const { lows, highs } = swings(candles4h, 2)
    const level = direction === 'long' ? (lows.at(-1) ?? last) : (highs.at(-1) ?? last)
    const invalidation = direction === 'long' ? level - 0.3 * atr4h : level + 0.3 * atr4h
    const target =
      direction === 'long'
        ? (facts.nearestResistance ?? last + 1.5 * atr4h)
        : (facts.nearestSupport ?? last - 1.5 * atr4h)
    const rr = Math.abs(target - last) / Math.max(Math.abs(last - invalidation), atr4h * 0.1)
    drafts.push({
      marketSymbol: market.symbol,
      symbol: market.baseAsset,
      pattern: 'momentum_turn',
      direction,
      level,
      invalidation,
      target,
      horizon: '1h-4h',
      volumeRatio: volRatio,
      retests: 0,
      score: 2 + (volRatio >= 1.1 ? 1 : 0) + (rr >= 1.2 ? 1 : 0),
      factsText: `1h RSI turned ${crossedUp ? 'up through' : 'down through'} 50 to ${currentRsi.toFixed(0)} in the last seven hours; price is ${((Math.abs(last - level) / last) * 100).toFixed(2)}% from the ${level.toFixed(dp)} level it needs to hold.`,
      rsi15m: null,
      anchors: anchorsFrom(candles4h),
      seed: seedFrom(market.symbol),
      facts,
    })
  }

  const recentCandles = candles4h.slice(-24)
  const tests = recentCandles.filter((candle) => candle.high >= rangeHigh * 0.997).length
  if (tests >= 3 && last < rangeHigh) {
    const lastThree = recentCandles.slice(-3).reduce((total, candle) => total + candle.volume, 0)
    const priorThree = recentCandles.slice(-6, -3).reduce((total, candle) => total + candle.volume, 0)
    const fading = priorThree > 0 && lastThree < priorThree * 0.9
    const invalidation = rangeHigh + 0.3 * atr4h
    const target = rangeLow + 0.25 * rangeHeight
    const rr = Math.abs(target - last) / Math.max(Math.abs(last - invalidation), atr4h * 0.1)
    drafts.push({
      marketSymbol: market.symbol,
      symbol: market.baseAsset,
      pattern: 'rejection_at_resistance',
      direction: 'short',
      level: rangeHigh,
      invalidation,
      target,
      horizon: '1h-4h',
      volumeRatio: volRatio,
      retests: tests,
      score: 2 + (fading ? 1 : 0) + (rr >= 1.2 ? 1 : 0),
      factsText: `${tests} tests of ${rangeHigh.toFixed(dp)} resistance in the last four days${fading ? ' with volume falling on each test' : ''}; price is ${(((rangeHigh - last) / last) * 100).toFixed(2)}% below the level.`,
      rsi15m: null,
      anchors: anchorsFrom(candles4h),
      seed: seedFrom(market.symbol),
      facts,
    })
  }

  const viable = drafts.filter((draft) => {
    const risk = Math.abs(facts.last - draft.invalidation)
    const reward = Math.abs(draft.target - facts.last)
    return risk > 0 && reward / risk >= 0.8
  })
  if (viable.length === 0) return null
  return viable.sort((a, b) => b.score - a.score)[0] ?? null
}

export function selectCandidates(drafts: Candidate[], max = 6): Candidate[] {
  const sorted = [...drafts].sort((a, b) => b.score - a.score)
  const strong = sorted.filter((draft) => draft.score >= 2)
  const weak = sorted.filter((draft) => draft.score < 2)
  return (strong.length >= 3 ? strong : [...strong, ...weak]).slice(0, max)
}

export function attachRsi15m(candidate: Candidate, candles15m: Candle[]): Candidate {
  const value = rsi(candles15m.map((candle) => candle.close)).at(-1)
  return { ...candidate, rsi15m: value ?? null }
}

/**
 * Near-miss patterns for the "Closest to forming" state. Code-only, no Jev involved.
 * Returns at most two candidates without odds, each with a condition sentence.
 */
export function nearMiss(facts: MarketFacts): Candidate[] {
  const { candles4h, last, atr4h, market } = facts
  if (candles4h.length < 74 || atr4h <= 0) return []
  // Measure the range before the recent window so an already-broken level is not treated as "pressing".
  const preWindow = candles4h.slice(-74, -8)
  if (preWindow.length < 66) return []
  const rangeHigh = Math.max(...preWindow.map((candle) => candle.high))
  const rangeLow = Math.min(...preWindow.map((candle) => candle.low))
  const rangeHeight = rangeHigh - rangeLow
  if (!(rangeHeight > 0)) return []
  const dp = market.pricePrecision
  const out: Candidate[] = []

  const base = {
    marketSymbol: market.symbol,
    symbol: market.baseAsset,
    direction: 'long' as const,
    horizon: '15m-1h',
    volumeRatio: volumeRatio(candles4h),
    retests: 0,
    score: 1,
    rsi15m: null,
    anchors: anchorsFrom(candles4h),
    seed: seedFrom(market.symbol),
    facts,
  }

  const recent = candles4h.slice(-6)
  if (recent.length === 6) {
    const widthNow =
      Math.max(...recent.map((candle) => candle.high)) - Math.min(...recent.map((candle) => candle.low))
    const widths: number[] = []
    for (let end = candles4h.length - 6; end >= Math.max(6, candles4h.length - 60); end--) {
      const slice = candles4h.slice(end - 6, end)
      const width = Math.max(...slice.map((candle) => candle.high)) - Math.min(...slice.map((candle) => candle.low))
      widths.push(width)
    }
    const percentile = widths.length === 0 ? 1 : widths.filter((width) => width < widthNow).length / widths.length
    if (percentile < 0.2) {
      const boxHigh = Math.max(...recent.map((candle) => candle.high))
      const boxLow = Math.min(...recent.map((candle) => candle.low))
      out.push({
        ...base,
        pattern: 'range_break',
        level: boxHigh,
        invalidation: boxLow,
        target: boxHigh + (boxHigh - boxLow),
        factsText: `Compressing: the last six candles trade in a ${(((boxHigh - boxLow) / last) * 100).toFixed(2)}% box.`,
        condition: `Needs a close outside ${boxHigh.toFixed(dp)} or ${boxLow.toFixed(dp)} on above-average volume.`,
        isForming: true,
      })
    }
  }

  if (out.length < 2 && rangeHigh - last <= 0.5 * atr4h && last < rangeHigh) {
    out.push({
      ...base,
      pattern: 'breakout_retest',
      level: rangeHigh,
      invalidation: rangeHigh - 0.5 * atr4h,
      target: rangeHigh + 0.75 * rangeHeight,
      factsText: `Price is pressing the ${rangeHigh.toFixed(dp)} range high from below.`,
      condition: `Needs a close above ${rangeHigh.toFixed(dp)} on above-average volume, then a retest that holds.`,
      isForming: true,
    })
  }

  if (out.length < 2 && last - rangeLow <= 0.5 * atr4h && facts.trend4h.includes('higher highs')) {
    out.push({
      ...base,
      pattern: 'momentum_turn',
      level: rangeLow,
      invalidation: rangeLow - 0.3 * atr4h,
      target: facts.nearestResistance ?? last + 1.5 * atr4h,
      factsText: `A pullback is approaching the ${rangeLow.toFixed(dp)} range low inside an uptrend.`,
      condition: `Needs to hold ${rangeLow.toFixed(dp)} with a higher low.`,
      isForming: true,
    })
  }

  return out.slice(0, 2)
}

export function medianAtrRatio(facts: MarketFacts[]): number {
  return median(facts.map((item) => item.atrRatio))
}
