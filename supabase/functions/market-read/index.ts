/**
 * market-read — Supabase Edge Function.
 *
 * Trigger: pg_cron + pg_net (or a manual curl) with the header `x-cron-secret`.
 * Body {"probe":true} runs the source probe from the deployed region and returns per-source
 * health without calling Jev or writing a row.
 * Fetches Binance public data, asks TypeSafe Jev for the market judgments, composes the
 * market-wide MarketRead payload and stores it in public.market_reads.
 *
 * I/O only: every read calculation lives in ../_shared/read.
 */
import { freshFallback, mapAnswers, parseJevResponse, WORTH_THRESHOLD } from '../_shared/read/answers.ts'
import { composeRead } from '../_shared/read/compose.ts'
import {
  computeCandidateDerivatives,
  computeDerivatives,
  type BinanceCoinInput,
  type DerivativesInput,
  type GateCoinInput,
} from '../_shared/read/derivatives.ts'
import { analyze, attachRsi15m, nearMiss, prescreen, selectCandidates } from '../_shared/read/facts.ts'
import {
  parseBinanceOiHistory,
  parseBinanceOpenInterest,
  parseBinancePremiumIndex,
  parseCoinMetrics,
  parseDefiLlamaStablecoins,
  parseGateContract,
  parseGateStats,
  parseHyperliquidFunding,
  parseHyperliquidMeta,
  parseKlinePayload,
  parseMempoolFees,
  parseMempoolStats,
  parseTickerPayload,
  type HlAssetContext,
} from '../_shared/read/marketData.ts'
import { computeOnchain } from '../_shared/read/onchain.ts'
import { median } from '../_shared/read/indicators.ts'
import { buildQuestions } from '../_shared/read/questions.ts'
import {
  COINMETRICS_MARKET_METRICS,
  HYPERLIQUID_INFO_URL,
  MEMPOOL_FEES_URL,
  MEMPOOL_STATS_URL,
  STABLECOIN_CHARTS_URL,
  binanceOpenInterest,
  binanceOpenInterestHistory,
  binancePremiumIndex,
  coinmetricsMetricsUrl,
  gateContractStatsUrl,
  gateContractUrl,
  hyperliquidFundingHistoryBody,
} from '../_shared/read/sources.ts'
import { buildState } from '../_shared/read/state.ts'
import {
  SETUP_TYPE_KEYS,
  type Candidate,
  type CandidateDerivatives,
  type DerivativesFacts,
  type InputsHealth,
  type JevResponse,
  type MarketFacts,
  type OnchainFacts,
  type PreviousInputs,
  type PreviousReadSummary,
  type SetupTypeKey,
  type StanceKey,
  type VolatilityLevel,
} from '../_shared/read/types.ts'
import { MARKETS } from '../../../src/lib/markets.ts'
import { runProbe } from './probe.ts'

interface DenoRuntime {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

const runtime = globalThis as unknown as { Deno: DenoRuntime }

const BINANCE_HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com']
const JEV_URL = 'https://api.typesafe.ai/v1/systemone'
const JEV_MODEL = 'jev-latest'
const REQUEST_TIMEOUT_MS = 10_000
const JEV_TIMEOUT_MS = 20_000
const JEV_ATTEMPTS = 3
const MIN_COVERAGE = 10
const MAX_CANDIDATES = 6
const MAX_FORMING = 6
const RECENT_READS = 96

const STANCE_KEYS: string[] = ['favorable', 'wait', 'unclear', 'reduce_risk']

interface StoredRead {
  as_of: string
  status: string
  model: string
  read: unknown
  answers: unknown
  usage: unknown
  inputs?: unknown
}

interface RunResult {
  status: 'ok' | 'degraded' | 'unavailable'
  inserted: boolean
  coverage: number
  candidates: number
  forming: number
  jevLatencyMs: number
  usage: { input_tokens: number; output_tokens: number } | null
  derivativesVenues: number
  onchainDate: string | null
  inputsHealth?: InputsHealth
}

const PERP_COINS: Array<{ key: 'btc' | 'eth'; perp: string; gate: string; hl: string }> = [
  { key: 'btc', perp: 'BTCUSDT', gate: 'BTC', hl: 'BTC' },
  { key: 'eth', perp: 'ETHUSDT', gate: 'ETH', hl: 'ETH' },
]

function requireEnv(name: string): string {
  const value = runtime.Deno.env.get(name)
  if (!value) throw new Error(`missing_env:${name}`)
  return value
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text()
    if (text.trim() === '') return null
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index++) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return diff === 0
}

async function fetchBinanceJson(path: string): Promise<unknown> {
  let lastError: unknown = null
  for (const host of BINANCE_HOSTS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(`${host}${path}`, { signal: controller.signal })
      if (!response.ok) {
        lastError = new Error(`binance_http_${response.status}`)
        continue
      }
      const text = await response.text()
      return JSON.parse(text) as unknown
    } catch (cause) {
      lastError = cause
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('binance_unreachable')
}

async function pool<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      const item = items[index]
      if (item === undefined) continue
      results[index] = await run(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function callJev(apiKey: string, state: unknown, questions: unknown): Promise<{ response: JevResponse; latencyMs: number }> {
  const payload = JSON.stringify({ model: JEV_MODEL, state, questions })
  let lastError: unknown = null
  for (let attempt = 1; attempt <= JEV_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), JEV_TIMEOUT_MS)
    const started = Date.now()
    try {
      const response = await fetch(JEV_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: payload,
        signal: controller.signal,
      })
      const latencyMs = Date.now() - started
      const text = await response.text()
      if ((response.status === 429 || response.status === 529) && attempt < JEV_ATTEMPTS) {
        await sleep(2 ** attempt * 1000)
        continue
      }
      if (!response.ok) throw new Error(`jev_http_${response.status}:${text.slice(0, 200)}`)
      return { response: parseJevResponse(JSON.parse(text)), latencyMs }
    } catch (cause) {
      lastError = cause
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('jev_unreachable')
}

async function supabaseRest(path: string, init?: RequestInit): Promise<unknown> {
  const url = requireEnv('SUPABASE_URL')
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`rest_http_${response.status}:${text.slice(0, 200)}`)
    }
    const text = await response.text()
    return text === '' ? null : (JSON.parse(text) as unknown)
  } finally {
    clearTimeout(timer)
  }
}

function isStoredRead(value: unknown): value is StoredRead {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.as_of === 'string' &&
    typeof record.status === 'string' &&
    typeof record.model === 'string' &&
    typeof record.read === 'object' &&
    record.read !== null &&
    typeof record.answers === 'object' &&
    record.answers !== null &&
    typeof record.usage === 'object' &&
    record.usage !== null
  )
}

function previousSetups(answers: JevResponse): Array<{ symbol: string; type: SetupTypeKey }> {
  const setups: Array<{ symbol: string; type: SetupTypeKey }> = []
  for (const [key, answer] of Object.entries(answers.answers)) {
    if (!key.endsWith('_worth') || answer.type !== 'noul' || answer.noul < WORTH_THRESHOLD) continue
    const symbol = key.slice(0, -'_worth'.length)
    const typeAnswer = answers.answers[`${symbol}_type`]
    if (
      typeAnswer?.type === 'choice' &&
      typeAnswer.choice !== 'none' &&
      (SETUP_TYPE_KEYS as string[]).includes(typeAnswer.choice)
    ) {
      setups.push({ symbol, type: typeAnswer.choice as SetupTypeKey })
    }
  }
  return setups
}

function toPreviousSummary(row: StoredRead): PreviousReadSummary | null {
  try {
    const answers = parseJevResponse({ model: row.model, answers: row.answers, usage: row.usage })
    if (typeof row.read !== 'object' || row.read === null) return null
    const read = row.read as Record<string, unknown>
    const rawStance = read.stance === 'reduce-risk' ? 'reduce_risk' : read.stance
    if (typeof rawStance !== 'string' || !STANCE_KEYS.includes(rawStance)) return null
    const regimeIndex =
      typeof read.regimeIndex === 'number' ? Math.min(4, Math.max(0, Math.round(read.regimeIndex))) : 2
    const stats = typeof read.stats === 'object' && read.stats !== null ? (read.stats as Record<string, unknown>) : {}
    const rawVolatility = typeof stats.volatility === 'number' ? stats.volatility : 1
    const volatility = Math.min(3, Math.max(0, Math.round(rawVolatility))) as VolatilityLevel
    return {
      asOf: row.as_of,
      regimeIndex,
      stance: rawStance as StanceKey,
      volatility,
      setups: previousSetups(answers),
    }
  } catch {
    return null
  }
}

async function recentReads(): Promise<StoredRead[]> {
  const payload = await supabaseRest(
    `market_reads?select=as_of,status,model,read,answers,usage,inputs&order=created_at.desc&limit=${RECENT_READS}`,
  )
  if (!Array.isArray(payload)) return []
  return payload.filter(isStoredRead)
}

function asLooseRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toPreviousInputs(row: StoredRead): PreviousInputs {
  const inputs = asLooseRecord(row.inputs)
  const derivatives = asLooseRecord(inputs?.derivatives)
  const onchain = asLooseRecord(inputs?.onchain)
  const derivativesOk =
    derivatives !== null && Array.isArray(derivatives.venues_answered) && asLooseRecord(derivatives.open_interest_usd) !== null
  const onchainOk = onchain !== null && typeof onchain.as_of_date === 'string' && asLooseRecord(onchain.btc) !== null
  return {
    asOf: row.as_of,
    derivatives: derivativesOk ? (derivatives as unknown as DerivativesFacts) : null,
    onchain: onchainOk ? (onchain as unknown as OnchainFacts) : null,
  }
}

async function insertRead(row: {
  asOf: string
  status: 'ok' | 'degraded'
  model: string
  read: unknown
  answers: unknown
  usage: unknown
  inputs: unknown
  inputsHealth: InputsHealth
}): Promise<void> {
  await supabaseRest('market_reads', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      as_of: row.asOf,
      status: row.status,
      model: row.model,
      read: row.read,
      answers: row.answers,
      usage: row.usage,
      inputs: row.inputs,
      inputs_health: row.inputsHealth,
    }),
  })
}

type FetchResult = { ok: true; data: unknown } | { ok: false; error: string }

async function fetchJsonTolerant(url: string, init?: RequestInit): Promise<FetchResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const text = await response.text()
    if (!response.ok) return { ok: false, error: `http_${response.status}` }
    return { ok: true, data: JSON.parse(text) as unknown }
  } catch (cause) {
    return { ok: false, error: messageOf(cause) }
  } finally {
    clearTimeout(timer)
  }
}

function postJson(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

function errorSummary(results: FetchResult[]): string {
  return results
    .filter((result): result is { ok: false; error: string } => !result.ok)
    .map((result) => result.error)
    .join(',')
}

interface DerivativesBundle {
  facts: DerivativesFacts | null
  contexts: HlAssetContext[]
  health: InputsHealth
}

async function fetchDerivativesBundle(input: {
  asOf: string
  facts: MarketFacts[]
  previousInputs: PreviousInputs[]
}): Promise<DerivativesBundle> {
  const { asOf, facts, previousInputs } = input
  const health: InputsHealth = {}
  const binance: DerivativesInput['binance'] = {}
  const gate: DerivativesInput['gate'] = {}
  const hlFunding: DerivativesInput['hyperliquid']['funding'] = {}
  let contexts: HlAssetContext[] = []

  let binanceError = ''
  for (const coin of PERP_COINS) {
    const [premium, interest, history] = await Promise.all([
      fetchJsonTolerant(binancePremiumIndex(coin.perp)),
      fetchJsonTolerant(binanceOpenInterest(coin.perp)),
      fetchJsonTolerant(binanceOpenInterestHistory(coin.perp)),
    ])
    if (!premium.ok || !interest.ok || !history.ok) {
      binanceError = errorSummary([premium, interest, history])
      continue
    }
    const parsedPremium = parseBinancePremiumIndex(premium.data)
    const parsedInterest = parseBinanceOpenInterest(interest.data)
    if (!parsedPremium || parsedInterest === null) {
      binanceError = 'invalid_payload'
      continue
    }
    binance[coin.key] = {
      premium: parsedPremium,
      openInterest: parsedInterest,
      history: parseBinanceOiHistory(history.data),
    }
  }
  health.binance_futures =
    Object.keys(binance).length > 0 ? { ok: true } : { ok: false, error: binanceError || 'unavailable' }

  let gateError = ''
  for (const coin of PERP_COINS) {
    const [contract, stats] = await Promise.all([
      fetchJsonTolerant(gateContractUrl(coin.gate)),
      fetchJsonTolerant(gateContractStatsUrl(coin.gate)),
    ])
    if (!contract.ok || !stats.ok) {
      gateError = errorSummary([contract, stats])
      continue
    }
    const parsedContract = parseGateContract(contract.data)
    if (!parsedContract) {
      gateError = 'invalid_payload'
      continue
    }
    gate[coin.key] = { contract: parsedContract, stats: parseGateStats(stats.data) }
  }
  health.gate_futures = Object.keys(gate).length > 0 ? { ok: true } : { ok: false, error: gateError || 'unavailable' }

  const meta = await fetchJsonTolerant(HYPERLIQUID_INFO_URL, postJson({ type: 'metaAndAssetCtxs' }))
  if (meta.ok) {
    contexts = parseHyperliquidMeta(meta.data)
    for (const coin of PERP_COINS) {
      const history = await fetchJsonTolerant(
        HYPERLIQUID_INFO_URL,
        postJson(hyperliquidFundingHistoryBody(coin.hl, Date.now() - 25 * 3_600_000)),
      )
      if (history.ok) hlFunding[coin.key] = parseHyperliquidFunding(history.data)
    }
    health.hyperliquid = contexts.length > 0 ? { ok: true } : { ok: false, error: 'invalid_payload' }
  } else {
    health.hyperliquid = { ok: false, error: meta.error }
  }

  const btc = facts.find((item) => item.market.symbol === 'BTCUSDT')
  const eth = facts.find((item) => item.market.symbol === 'ETHUSDT')
  const derivativesInput: DerivativesInput = {
    asOf,
    binance,
    gate,
    hyperliquid: { contexts, funding: hlFunding },
    priceHistory1h: {
      btc: btc?.candles1h.map((candle) => candle.close) ?? [],
      eth: eth?.candles1h.map((candle) => candle.close) ?? [],
    },
    change24hPct: { btc: btc?.change24h, eth: eth?.change24h },
    previous: {
      oiUsd: previousInputs.map((entry) => ({
        asOf: entry.asOf,
        openInterestUsd: entry.derivatives?.open_interest_usd ?? {},
      })),
      funding: previousInputs.map((entry) => ({ asOf: entry.asOf, funding: entry.derivatives?.funding ?? {} })),
    },
  }

  return { facts: computeDerivatives(derivativesInput), contexts, health }
}

async function fetchOnchainBundle(input: {
  asOf: string
  previousInputs: PreviousInputs[]
}): Promise<{ facts: OnchainFacts | null; health: InputsHealth }> {
  const { asOf, previousInputs } = input
  const health: InputsHealth = {}

  const previousFees = previousInputs
    .map((entry) => ({ asOf: entry.asOf, fee: entry.onchain?.btc_mempool?.fastest_fee_sat_vb }))
    .filter((sample): sample is { asOf: string; fee: number } => typeof sample.fee === 'number')

  const [feesResult, statsResult] = await Promise.all([
    fetchJsonTolerant(MEMPOOL_FEES_URL),
    fetchJsonTolerant(MEMPOOL_STATS_URL),
  ])
  const fastestFee = feesResult.ok ? parseMempoolFees(feesResult.data) : null
  const txCount = statsResult.ok ? parseMempoolStats(statsResult.data) : null
  const mempool = fastestFee !== null && txCount !== null ? { fastestFee, txCount } : null
  health.mempool = mempool ? { ok: true } : { ok: false, error: errorSummary([feesResult, statsResult]) || 'invalid_payload' }

  const today = asOf.slice(0, 10)
  const recent = previousInputs.at(-1)
  if (recent?.onchain && recent.asOf.slice(0, 10) === today) {
    // On-chain data is daily; reuse the facts fetched earlier today and refresh the live mempool fields.
    const cached = recent.onchain
    const fees = previousFees.map((sample) => sample.fee)
    const medianFee = fees.length >= 5 ? median(fees) : null
    const feeChange =
      mempool === null || medianFee === null || medianFee === 0
        ? (cached.btc_mempool?.fastest_fee_vs_7d_median_pct ?? null)
        : Math.round(((mempool.fastestFee - medianFee) / medianFee) * 100 * 10) / 10
    health.coinmetrics = { ok: true }
    health.defillama = { ok: true }
    return {
      facts: {
        ...cached,
        btc_mempool: mempool
          ? { tx_count: mempool.txCount, fastest_fee_sat_vb: mempool.fastestFee, fastest_fee_vs_7d_median_pct: feeChange }
          : cached.btc_mempool,
      },
      health,
    }
  }

  // Coin Metrics pages per asset: one request per asset, otherwise a 35-row page can hold a single asset.
  const [btcMetrics, ethMetrics, defillama] = await Promise.all([
    fetchJsonTolerant(coinmetricsMetricsUrl(['btc'], COINMETRICS_MARKET_METRICS)),
    fetchJsonTolerant(coinmetricsMetricsUrl(['eth'], COINMETRICS_MARKET_METRICS)),
    fetchJsonTolerant(STABLECOIN_CHARTS_URL),
  ])
  const btcDays = btcMetrics.ok ? parseCoinMetrics(btcMetrics.data) : []
  const ethDays = ethMetrics.ok ? parseCoinMetrics(ethMetrics.data) : []
  health.coinmetrics =
    btcDays.length > 0 && ethDays.length > 0
      ? { ok: true }
      : { ok: false, error: errorSummary([btcMetrics, ethMetrics]) || 'invalid_payload' }

  const defillamaRows = defillama.ok ? parseDefiLlamaStablecoins(defillama.data) : null
  const facts = computeOnchain({
    asOf,
    btcDays,
    ethDays,
    defillama: defillamaRows,
    mempool,
    previousFees,
  })
  health.defillama =
    defillamaRows !== null && defillamaRows.length > 0 ? { ok: true } : { ok: false, error: defillama.ok ? 'invalid_payload' : defillama.error }

  return { facts, health }
}

async function fetchCandidateDerivatives(input: {
  candidate: Candidate
  contexts: HlAssetContext[]
  asOf: string
}): Promise<CandidateDerivatives | null> {
  const { candidate, contexts, asOf } = input
  const binanceResults = await Promise.all([
    fetchJsonTolerant(binancePremiumIndex(candidate.marketSymbol)),
    fetchJsonTolerant(binanceOpenInterest(candidate.marketSymbol)),
    fetchJsonTolerant(binanceOpenInterestHistory(candidate.marketSymbol)),
  ])
  let binance: BinanceCoinInput | undefined
  if (binanceResults.every((result) => result.ok)) {
    const [premiumResult, interestResult, historyResult] = binanceResults
    const premium = premiumResult.ok ? parseBinancePremiumIndex(premiumResult.data) : null
    const openInterest = interestResult.ok ? parseBinanceOpenInterest(interestResult.data) : null
    const history = historyResult.ok ? parseBinanceOiHistory(historyResult.data) : []
    if (premium && openInterest !== null) binance = { premium, openInterest, history }
  }

  let gate: GateCoinInput | undefined
  if (!binance) {
    const base = candidate.symbol
    const [contractResult, statsResult] = await Promise.all([
      fetchJsonTolerant(gateContractUrl(base)),
      fetchJsonTolerant(gateContractStatsUrl(base)),
    ])
    if (contractResult.ok && statsResult.ok) {
      const contract = parseGateContract(contractResult.data)
      if (contract) gate = { contract, stats: parseGateStats(statsResult.data) }
    }
  }

  const hyperliquidContext =
    contexts.find((entry) => entry.coin.toUpperCase() === candidate.symbol.toUpperCase()) ?? null
  if (!binance && !gate && !hyperliquidContext) return null

  return computeCandidateDerivatives({
    ...(binance ? { binance } : {}),
    ...(gate ? { gate } : {}),
    hyperliquidContext,
    priceHistory1h: candidate.facts.candles1h.map((candle) => candle.close),
    change24hPct: candidate.facts.change24h,
    previousOiUsd: [],
    asOf,
  })
}

async function run(): Promise<RunResult> {
  const symbols = MARKETS.map((market) => market.symbol)
  const tickerPayload = await fetchBinanceJson(
    `/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`,
  )
  const tickers = parseTickerPayload(tickerPayload)
  const tickerMap = new Map(tickers.map((ticker) => [ticker.symbol, ticker]))

  const perMarket = await pool(MARKETS, 4, async (market) => {
    const [raw4h, raw1h] = await Promise.all([
      fetchBinanceJson(`/api/v3/klines?symbol=${encodeURIComponent(market.symbol)}&interval=4h&limit=180`),
      fetchBinanceJson(`/api/v3/klines?symbol=${encodeURIComponent(market.symbol)}&interval=1h&limit=168`),
    ])
    return {
      market,
      candles4h: parseKlinePayload(raw4h),
      candles1h: parseKlinePayload(raw1h),
    }
  })

  const facts: MarketFacts[] = []
  for (const entry of perMarket) {
    const ticker = tickerMap.get(entry.market.symbol)
    if (!ticker || entry.candles4h.length < 74) continue
    facts.push(analyze(entry.market, entry.candles4h, entry.candles1h, ticker))
  }

  const hasMajors = facts.some((item) => item.market.symbol === 'BTCUSDT') && facts.some((item) => item.market.symbol === 'ETHUSDT')
  if (facts.length < MIN_COVERAGE || !hasMajors) {
    return {
      status: 'unavailable',
      inserted: false,
      coverage: facts.length,
      candidates: 0,
      forming: 0,
      jevLatencyMs: 0,
      usage: null,
      derivativesVenues: 0,
      onchainDate: null,
    }
  }

  const rows = await recentReads()
  const previousInputs = rows.map((row) => toPreviousInputs(row)).reverse()

  const drafts = facts.map((item) => prescreen(item)).filter((item): item is Candidate => item !== null)
  const selected = selectCandidates(drafts, MAX_CANDIDATES)
  const candidates: Candidate[] = []
  for (const candidate of selected) {
    const raw15m = await fetchBinanceJson(
      `/api/v3/klines?symbol=${encodeURIComponent(candidate.marketSymbol)}&interval=15m&limit=96`,
    )
    candidates.push(attachRsi15m(candidate, parseKlinePayload(raw15m)))
  }
  const formingCandidates = facts.flatMap((item) => nearMiss(item)).slice(0, MAX_FORMING)

  const asOf = new Date().toISOString()

  const derivativesBundle = await fetchDerivativesBundle({ asOf, facts, previousInputs })
  for (const candidate of candidates) {
    candidate.derivatives = await fetchCandidateDerivatives({
      candidate,
      contexts: derivativesBundle.contexts,
      asOf,
    })
  }
  const onchainBundle = await fetchOnchainBundle({ asOf, previousInputs })
  const inputsHealth: InputsHealth = { ...derivativesBundle.health, ...onchainBundle.health }

  const summaries = rows
    .map((row) => toPreviousSummary(row))
    .filter((item): item is PreviousReadSummary => item !== null)
    .reverse()
  const previousSummary = summaries.at(-1) ?? null

  const rsi15mBySymbol: Record<string, number> = {}
  for (const candidate of candidates) {
    if (candidate.rsi15m !== null) rsi15mBySymbol[candidate.symbol] = candidate.rsi15m
  }

  const state = buildState({
    asOf,
    facts,
    tickers,
    previousRead: previousSummary,
    candidates,
    rsi15mBySymbol,
    derivatives: derivativesBundle.facts,
    onchain: onchainBundle.facts,
  })
  const questions = buildQuestions(candidates, {
    derivatives: derivativesBundle.facts !== null,
    onchain: onchainBundle.facts !== null,
  })

  let status: 'ok' | 'degraded' = 'ok'
  let response: JevResponse
  let jevLatencyMs = 0
  let judgedAt: string | undefined
  try {
    const result = await callJev(requireEnv('TYPESAFE_API_KEY'), state, questions)
    response = result.response
    jevLatencyMs = result.latencyMs
  } catch (cause) {
    const previous = freshFallback(rows, asOf)
    if (!previous) throw new Error(`jev_failed_without_fresh_read:${messageOf(cause)}`)
    response = parseJevResponse({ model: previous.model, answers: previous.answers, usage: previous.usage })
    status = 'degraded'
    judgedAt = previous.as_of
  }

  // Setup odds were judged against that read's levels, which this cycle recomputed, so a
  // degraded read keeps only the slower market-wide judgments.
  const covered = status === 'degraded' ? [] : candidates
  const mapped = mapAnswers(response, covered)
  const read = composeRead({
    asOf,
    judgedAt,
    facts,
    candidates: formingCandidates,
    mapped,
    previousReads: summaries,
    derivatives: derivativesBundle.facts,
    onchain: onchainBundle.facts,
    previousInputs,
  })

  await insertRead({
    asOf,
    status,
    model: response.model,
    read,
    answers: response.answers,
    usage: response.usage,
    inputs: { derivatives: derivativesBundle.facts, onchain: onchainBundle.facts },
    inputsHealth,
  })

  return {
    status,
    inserted: true,
    coverage: facts.length,
    candidates: covered.length,
    forming: formingCandidates.length,
    jevLatencyMs,
    usage: response.usage,
    derivativesVenues: derivativesBundle.facts?.venues_answered.length ?? 0,
    onchainDate: onchainBundle.facts?.as_of_date ?? null,
    inputsHealth,
  }
}

runtime.Deno.serve(async (request: Request): Promise<Response> => {
  const json = (code: number, body: unknown): Response =>
    new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json' } })

  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  let expected: string
  try {
    expected = requireEnv('READ_CRON_SECRET')
  } catch (cause) {
    return json(500, { error: messageOf(cause) })
  }
  const provided = request.headers.get('x-cron-secret') ?? ''
  if (!safeEqual(provided, expected)) return json(401, { error: 'unauthorized' })

  const body = await readJsonBody(request)
  if (body?.probe === true) {
    const sources = await runProbe()
    const failed = Object.entries(sources)
      .filter(([, report]) => !report.ok)
      .map(([id]) => id)
    console.log(JSON.stringify({ event: 'market_read_probe', failed, sources }))
    return json(200, { probe: true, as_of_utc: new Date().toISOString(), sources })
  }

  try {
    const result = await run()
    console.log(JSON.stringify({ event: 'market_read', ...result }))
    return json(result.inserted ? 200 : 503, result)
  } catch (cause) {
    const message = messageOf(cause)
    console.error(JSON.stringify({ event: 'market_read_error', message }))
    return json(500, { error: message })
  }
})
