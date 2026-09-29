import { describe, expect, it } from 'vitest'
import { MARKETS } from '../../../../src/lib/markets.ts'
import { mapAnswers, parseJevResponse } from './answers.ts'
import { composeRead } from './compose.ts'
import { computeDerivatives } from './derivatives.ts'
import { analyze, attachRsi15m, prescreen, selectCandidates } from './facts.ts'
import { buildQuestions } from './questions.ts'
import { buildState } from './state.ts'
import { collectCopy, findC4Violations } from './__fixtures__/c4.ts'
import { candidateAnswers, choice, makeResponse, marketAnswers } from './__fixtures__/answers.ts'
import { SPIKE_ANSWERS } from './__fixtures__/spike-answers.ts'
import { mockCandidate, mockFacts, mockTicker, previousRead } from './__fixtures__/mock.ts'
import {
  breakoutRetestScenario,
  momentumTurnScenario,
  rangeBoundScenario,
  rejectionScenario,
  type Scenario,
} from './__fixtures__/candles.ts'
import type { Candidate, MarketFacts, Ticker } from './types.ts'

const AS_OF = '2026-09-28T14:30:00.000Z'

function getMarket(symbol: string) {
  const market = MARKETS.find((item) => item.symbol === symbol)
  if (!market) throw new Error(`fixture market missing: ${symbol}`)
  return market
}

function factsFromScenario(symbol: string, scenario: Scenario): MarketFacts {
  const market = getMarket(symbol)
  const last = scenario.candles4h.at(-1)?.close ?? 100
  return analyze(market, scenario.candles4h, scenario.candles1h, mockTicker(symbol, { lastPrice: String(last) }))
}

function copy15m(candidate: Candidate): Candidate {
  const closes = Array.from({ length: 96 }, (_, index) => 100 + index * 0.1)
  return attachRsi15m(
    candidate,
    closes.map((close, index) => ({ time: index * 900, open: close, high: close, low: close, close, volume: 1 })),
  )
}

describe('recorded spike pipeline', () => {
  it('composes a Wait read from the recorded jev response', () => {
    const btc = mockFacts('BTCUSDT', {
      last: 84686,
      change24h: 0.7,
      rsi1h: 55.3,
      atrRatio: 0.85,
      nearestResistance: 84942.45,
      nearestSupport: 83838,
      volVs7dPct: -48.4,
      aboveEma50: true,
    })
    const eth = mockFacts('ETHUSDT', {
      last: 2695.38,
      change24h: 0.27,
      rsi1h: 48.4,
      atrRatio: 0.8,
      nearestResistance: 2697.79,
      nearestSupport: 2679.3,
      aboveEma50: true,
    })
    const xrp = mockFacts('XRPUSDT', { last: 1.5313, change24h: -0.27, rsi1h: 50.9, atrRatio: 1.11 })
    const candidate = mockCandidate('XRP', '1h-4h', {
      pattern: 'momentum_turn',
      facts: xrp,
      rsi15m: 58.1,
    })

    const mapped = mapAnswers(parseJevResponse(SPIKE_ANSWERS), [candidate])
    const payload = composeRead({
      asOf: AS_OF,
      facts: [btc, eth, xrp],
      candidates: [],
      mapped,
      previousReads: [],
    })

    expect(payload.stance).toBe('wait')
    expect(payload.verdict).toBe('Wait.')
    expect(payload.setups).toHaveLength(0)
    expect(payload.stats.strength).toBe(21)
    expect(payload.stats.risk).toBe(1)
    expect(payload.stats.confidence).toBe(1)
    expect(payload.tags.XRP).toBeDefined()
    expect(findC4Violations(collectCopy(payload))).toEqual([])
  })
})

describe('live-style pipeline', () => {
  it('runs prescreen, state, questions, answers and compose end to end', () => {
    const btc = factsFromScenario('BTCUSDT', breakoutRetestScenario())
    const eth = factsFromScenario('ETHUSDT', rangeBoundScenario())
    const sol = factsFromScenario('SOLUSDT', momentumTurnScenario())
    const xrp = factsFromScenario('XRPUSDT', rejectionScenario())
    const facts = [btc, eth, sol, xrp]

    const drafts = facts
      .map((item) => prescreen(item))
      .filter((item): item is Candidate => item !== null)
    const candidates = selectCandidates(drafts, 6).map(copy15m)
    expect(candidates.length).toBeGreaterThanOrEqual(1)

    const tickers: Ticker[] = facts.map((item) =>
      mockTicker(item.market.symbol, { changePercent: String(item.change24h) }),
    )
    const state = buildState({
      asOf: AS_OF,
      facts,
      tickers,
      previousRead: previousRead({ regimeIndex: 2 }),
      candidates,
      rsi15mBySymbol: Object.fromEntries(candidates.map((item) => [item.symbol, item.rsi15m ?? 0])),
    })
    expect(Object.keys(state.candidates).length).toBe(candidates.length)

    const questions = buildQuestions(candidates)
    const answers = marketAnswers({
      stance: choice('favorable', 0.9),
      regime: choice('constructive', 0.8),
      bias: choice('bullish', 0.9),
    })
    for (const candidate of candidates) {
      Object.assign(answers, candidateAnswers(candidate.symbol, { worth: 0.8 }))
    }
    for (const id of Object.keys(questions)) {
      expect(answers[id], `missing answer for ${id}`).toBeDefined()
    }

    const mapped = mapAnswers(makeResponse(answers), candidates)
    expect(mapped.setups.length).toBeGreaterThanOrEqual(1)

    const payload = composeRead({ asOf: AS_OF, facts, candidates: [], mapped, previousReads: [] })
    expect(payload.setups.length).toBeGreaterThanOrEqual(1)
    expect(payload.coverage).toBe('4 markets')
    expect(findC4Violations(collectCopy(payload))).toEqual([])
  })
})

describe('derivatives pipeline with a failing venue', () => {
  it('keeps working when Binance futures fails but Gate and Hyperliquid answer', () => {
    const facts: MarketFacts[] = [
      mockFacts('BTCUSDT', { last: 100_000, change24h: 1.2 }),
      mockFacts('ETHUSDT', { last: 4_000, change24h: 0.6 }),
    ]
    const derivatives = computeDerivatives({
      asOf: AS_OF,
      binance: {},
      gate: {
        btc: {
          contract: { fundingRate8h: 0.0001, markPrice: 100_000, openInterestUsd: 2_000_000_000 },
          stats: [
            { time: Date.parse(AS_OF) / 1000 - 3600, openInterestUsd: 1_900_000_000, longLiqUsd: 100_000, shortLiqUsd: 20_000, lsrAccount: 1.2 },
            { time: Date.parse(AS_OF) / 1000, openInterestUsd: 2_000_000_000, longLiqUsd: 300_000, shortLiqUsd: 60_000, lsrAccount: 1.3 },
          ],
        },
      },
      hyperliquid: {
        contexts: [{ coin: 'BTC', fundingHourly: 0.00002, openInterestCoins: 100, markPx: 100_000 }],
        funding: { btc: [{ time: Date.parse(AS_OF) - 3_600_000, rateHourly: 0.00002 }] },
      },
      priceHistory1h: { btc: [99, 100], eth: [3_990, 4_000] },
      change24hPct: { btc: 1.2, eth: 0.6 },
      previous: { oiUsd: [], funding: [] },
    })
    expect(derivatives).not.toBeNull()
    if (!derivatives) return
    expect(derivatives.venues_failed).toEqual(['binance_futures'])
    expect(derivatives.venues_answered).toEqual(['gate_futures', 'hyperliquid'])

    const state = buildState({
      asOf: AS_OF,
      facts,
      tickers: [mockTicker('BTCUSDT'), mockTicker('ETHUSDT')],
      previousRead: previousRead(),
      candidates: [],
      rsi15mBySymbol: {},
      derivatives,
      onchain: null,
    })
    expect(state.derivatives?.venues_answered).toContain('gate_futures')
    expect('onchain' in state).toBe(false)

    const answers = makeResponse({
      ...marketAnswers(),
      positioning: choice('building_leverage', 0.8),
      ...candidateAnswers('BTC', { worth: 0.2 }),
    })
    const mapped = mapAnswers(answers, [])
    expect(mapped.positioning).toBe('building_leverage')

    const payload = composeRead({
      asOf: AS_OF,
      facts,
      candidates: [],
      mapped,
      previousReads: [],
      derivatives,
      onchain: null,
    })
    const positioning = payload.evidence.find((well) => well.label === 'Positioning')
    const onchainWell = payload.evidence.find((well) => well.label === 'On-chain')
    expect(positioning?.state).toBe('Leverage rising')
    expect(onchainWell?.state).toBe('Unavailable')
    expect(findC4Violations(collectCopy(payload))).toEqual([])
  })
})
