/**
 * market-read — Supabase Edge Function.
 *
 * Trigger: pg_cron + pg_net (or a manual curl) with the header `x-cron-secret`.
 * Fetches Binance public data, asks TypeSafe Jev for the market judgments, composes the
 * market-wide MarketRead payload and stores it in public.market_reads.
 *
 * I/O only: every read calculation lives in ../_shared/read.
 */
import { mapAnswers, parseJevResponse, WORTH_THRESHOLD } from '../_shared/read/answers.ts'
import { composeRead } from '../_shared/read/compose.ts'
import { analyze, attachRsi15m, nearMiss, prescreen, selectCandidates } from '../_shared/read/facts.ts'
import { parseKlinePayload, parseTickerPayload } from '../_shared/read/marketData.ts'
import { buildQuestions } from '../_shared/read/questions.ts'
import { buildState } from '../_shared/read/state.ts'
import {
  SETUP_TYPE_KEYS,
  type Candidate,
  type JevResponse,
  type MarketFacts,
  type PreviousReadSummary,
  type SetupTypeKey,
  type StanceKey,
  type VolatilityLevel,
} from '../_shared/read/types.ts'
import { MARKETS } from '../../../src/lib/markets.ts'

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
}

interface RunResult {
  status: 'ok' | 'degraded' | 'unavailable'
  inserted: boolean
  coverage: number
  candidates: number
  forming: number
  jevLatencyMs: number
  usage: { input_tokens: number; output_tokens: number } | null
}

function requireEnv(name: string): string {
  const value = runtime.Deno.env.get(name)
  if (!value) throw new Error(`missing_env:${name}`)
  return value
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
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
    `market_reads?select=as_of,status,model,read,answers,usage&order=created_at.desc&limit=${RECENT_READS}`,
  )
  if (!Array.isArray(payload)) return []
  return payload.filter(isStoredRead)
}

async function insertRead(row: {
  asOf: string
  status: 'ok' | 'degraded'
  model: string
  read: unknown
  answers: unknown
  usage: unknown
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
    }),
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
    }
  }

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

  const rows = await recentReads()
  const summaries = rows
    .map((row) => toPreviousSummary(row))
    .filter((item): item is PreviousReadSummary => item !== null)
    .reverse()
  const previousSummary = summaries.at(-1) ?? null

  const asOf = new Date().toISOString()
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
  })
  const questions = buildQuestions(candidates)

  let status: 'ok' | 'degraded' = 'ok'
  let response: JevResponse
  let jevLatencyMs = 0
  try {
    const result = await callJev(requireEnv('TYPESAFE_API_KEY'), state, questions)
    response = result.response
    jevLatencyMs = result.latencyMs
  } catch (cause) {
    const previous = rows[0]
    if (!previous) throw new Error(`jev_failed_without_previous_read:${messageOf(cause)}`)
    response = parseJevResponse({ model: previous.model, answers: previous.answers, usage: previous.usage })
    status = 'degraded'
  }

  const covered =
    status === 'degraded' ? candidates.filter((candidate) => response.answers[`${candidate.symbol}_worth`] !== undefined) : candidates
  const mapped = mapAnswers(response, covered)
  const read = composeRead({
    asOf,
    facts,
    candidates: formingCandidates,
    mapped,
    previousReads: summaries,
  })

  await insertRead({
    asOf,
    status,
    model: response.model,
    read,
    answers: response.answers,
    usage: response.usage,
  })

  return {
    status,
    inserted: true,
    coverage: facts.length,
    candidates: covered.length,
    forming: formingCandidates.length,
    jevLatencyMs,
    usage: response.usage,
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
