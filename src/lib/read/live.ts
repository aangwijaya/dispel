import { friendlyDbError } from '../errors'
import { supabase } from '../supabase'
import type {
  ChangeEvent,
  Confidence,
  Evidence,
  Level,
  ReadPayload,
  ReadTag,
  RegimeShift,
  RibbonSegment,
  RiskLevel,
  Setup,
  Stance,
  StanceOdds,
  Tone,
  Volatility,
} from '../../types/read'

export interface LiveRead {
  id: string
  readAt: string
  asOf: string
  status: 'ok' | 'degraded'
  model: string
  read: ReadPayload
}

export type Freshness = 'fresh' | 'stale' | 'expired'

export const FRESH_MS = 20 * 60_000
export const STALE_MS = 45 * 60_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

const TONES: readonly Tone[] = ['up', 'down', 'caution', 'neutral']
const STANCES: readonly Stance[] = ['favorable', 'wait', 'unclear', 'reduce-risk']

function isTone(value: unknown): value is Tone {
  return isEnum(value, TONES)
}

function parseLevel(value: unknown): Level | null {
  if (!isRecord(value) || !isString(value.value) || !isString(value.note)) return null
  return { value: value.value, note: value.note }
}

function parseSetup(value: unknown): Setup | null {
  if (!isRecord(value)) return null
  const invalidation = parseLevel(value.invalidation)
  const target = parseLevel(value.target)
  if (
    !isString(value.symbol) ||
    !isString(value.monogram) ||
    !isString(value.bias) ||
    !isTone(value.tone) ||
    !isString(value.summary) ||
    !isNumber(value.confidence) ||
    !isNumber(value.risk) ||
    !isString(value.horizon) ||
    !isString(value.price) ||
    !isNumber(value.changePct) ||
    !Array.isArray(value.sees) ||
    !value.sees.every(isString) ||
    !Array.isArray(value.anchors) ||
    !value.anchors.every(isNumber) ||
    !isNumber(value.seed) ||
    !invalidation ||
    !target
  ) {
    return null
  }
  const odds = value.odds === null ? null : isNumber(value.odds) ? value.odds : null
  return {
    symbol: value.symbol,
    monogram: value.monogram,
    bias: value.bias,
    tone: value.tone,
    ...(value.isNew === true ? { isNew: true } : {}),
    summary: value.summary,
    odds,
    confidence: Math.min(2, Math.max(0, Math.round(value.confidence))) as Confidence,
    risk: Math.min(2, Math.max(0, Math.round(value.risk))) as RiskLevel,
    horizon: value.horizon,
    price: value.price,
    changePct: value.changePct,
    ...(isString(value.condition) ? { condition: value.condition } : {}),
    sees: value.sees,
    invalidation,
    target,
    anchors: value.anchors,
    seed: value.seed,
  }
}

function parseEvidence(value: unknown): Evidence | null {
  if (!isRecord(value) || !isString(value.label) || !isString(value.state) || !isTone(value.tone) || !isString(value.detail)) {
    return null
  }
  return { label: value.label, state: value.state, tone: value.tone, detail: value.detail }
}

function parseChange(value: unknown): ChangeEvent | null {
  if (
    !isRecord(value) ||
    !isString(value.time) ||
    !isString(value.subject) ||
    !isEnum(value.kind, ['info', 'caution', 'shift'] as const) ||
    !isString(value.text) ||
    !isString(value.detail)
  ) {
    return null
  }
  return { time: value.time, subject: value.subject, kind: value.kind, text: value.text, detail: value.detail }
}

function parseRibbon(value: unknown): RibbonSegment | null {
  if (!isRecord(value) || !isNumber(value.from) || !isNumber(value.to) || !isNumber(value.regime)) return null
  return { from: value.from, to: value.to, regime: Math.min(4, Math.max(0, Math.round(value.regime))) }
}

function parseShift(value: unknown): RegimeShift | null {
  if (value === null) return null
  if (
    !isRecord(value) ||
    !isString(value.time) ||
    !isNumber(value.from) ||
    !isNumber(value.to) ||
    !isString(value.why)
  ) {
    return null
  }
  return { time: value.time, from: Math.round(value.from), to: Math.round(value.to), why: value.why }
}

function parsePct(value: unknown): number | null {
  return isNumber(value) ? Math.min(100, Math.max(0, Math.round(value))) : null
}

function parseSplit(value: unknown): StanceOdds[] | null {
  if (!Array.isArray(value) || value.length > 2) return null
  const split: StanceOdds[] = []
  for (const item of value) {
    if (!isRecord(item) || !isEnum(item.stance, STANCES)) return null
    const pct = parsePct(item.pct)
    if (pct === null) return null
    split.push({ stance: item.stance, pct })
  }
  return split
}

function parseTag(value: unknown): ReadTag | null {
  if (!isRecord(value) || !isString(value.label) || !isTone(value.tone)) return null
  return { label: value.label, tone: value.tone }
}

/** Strict sanitizer for a stored market-wide ReadPayload. Rejects the payload on any malformed field. */
export function toReadPayload(value: unknown): ReadPayload | null {
  if (!isRecord(value)) return null
  const stats = isRecord(value.stats) ? value.stats : null
  const breadth = isRecord(value.breadth) ? value.breadth : null
  if (
    !isEnum(value.stance, STANCES) ||
    !isString(value.verdict) ||
    !isString(value.bias) ||
    !isTone(value.biasTone) ||
    !isString(value.biasLine) ||
    !isString(value.explainLead) ||
    !isString(value.explainRest) ||
    !isString(value.caution) ||
    !isString(value.time) ||
    !isString(value.coverage) ||
    !isNumber(value.regimeIndex) ||
    !Array.isArray(value.ribbon) ||
    !Array.isArray(value.evidence) ||
    !Array.isArray(value.setups) ||
    !Array.isArray(value.forming) ||
    !Array.isArray(value.changes) ||
    !isRecord(value.tags) ||
    !stats ||
    !breadth
  ) {
    return null
  }

  const ribbon: RibbonSegment[] = []
  for (const item of value.ribbon) {
    const parsed = parseRibbon(item)
    if (!parsed) return null
    ribbon.push(parsed)
  }
  const evidence: Evidence[] = []
  for (const item of value.evidence) {
    const parsed = parseEvidence(item)
    if (!parsed) return null
    evidence.push(parsed)
  }
  const setups: Setup[] = []
  for (const item of value.setups) {
    const parsed = parseSetup(item)
    if (!parsed) return null
    setups.push(parsed)
  }
  const forming: Setup[] = []
  for (const item of value.forming) {
    const parsed = parseSetup(item)
    if (!parsed) return null
    forming.push(parsed)
  }
  const changes: ChangeEvent[] = []
  for (const item of value.changes) {
    const parsed = parseChange(item)
    if (!parsed) return null
    changes.push(parsed)
  }
  const tags: Record<string, ReadTag> = {}
  for (const [key, item] of Object.entries(value.tags)) {
    const parsed = parseTag(item)
    if (!parsed) return null
    tags[key] = parsed
  }

  const shift = parseShift(value.shift)
  if (value.shift !== null && shift === null) return null
  const split = stats.split === undefined ? undefined : parseSplit(stats.split)
  const riskRaisedPct = stats.riskRaisedPct === undefined ? undefined : parsePct(stats.riskRaisedPct)
  if (split === null || riskRaisedPct === null) return null
  if (value.judgedTime !== undefined && !isString(value.judgedTime)) return null
  if (
    !isNumber(stats.strength) ||
    !isNumber(stats.confidence) ||
    !isNumber(stats.risk) ||
    !isNumber(stats.volatility) ||
    !isNumber(breadth.up) ||
    !isNumber(breadth.down)
  ) {
    return null
  }

  return {
    stance: value.stance,
    verdict: value.verdict,
    bias: value.bias,
    biasTone: value.biasTone,
    biasLine: value.biasLine,
    explainLead: value.explainLead,
    explainRest: value.explainRest,
    caution: value.caution,
    time: value.time,
    ...(isString(value.judgedTime) ? { judgedTime: value.judgedTime } : {}),
    coverage: value.coverage,
    regimeIndex: Math.min(4, Math.max(0, Math.round(value.regimeIndex))),
    ribbon,
    shift,
    stats: {
      strength: Math.min(100, Math.max(0, stats.strength)),
      confidence: Math.min(2, Math.max(0, Math.round(stats.confidence))) as Confidence,
      ...(split === undefined ? {} : { split }),
      risk: Math.min(2, Math.max(0, Math.round(stats.risk))) as RiskLevel,
      ...(riskRaisedPct === undefined ? {} : { riskRaisedPct }),
      volatility: Math.min(3, Math.max(0, Math.round(stats.volatility))) as Volatility,
    },
    evidence,
    setups,
    forming,
    changes,
    breadth: { up: Math.max(0, breadth.up), down: Math.max(0, breadth.down) },
    tags,
  }
}

/** Strict sanitizer for a `market_reads` / `market_read_latest` row. */
export function toLiveRead(row: unknown): LiveRead | null {
  if (!isRecord(row)) return null
  if (
    !isString(row.id) ||
    !isString(row.created_at) ||
    !isString(row.as_of) ||
    !isEnum(row.status, ['ok', 'degraded'] as const) ||
    !isString(row.model)
  ) {
    return null
  }
  const read = toReadPayload(row.read)
  if (!read) return null
  return { id: row.id, readAt: row.created_at, asOf: row.as_of, status: row.status, model: row.model, read }
}

export function freshnessOf(readAt: string, nowMs = Date.now()): Freshness {
  const parsed = Date.parse(readAt)
  if (!Number.isFinite(parsed)) return 'expired'
  const age = Math.max(0, nowMs - parsed)
  if (age < FRESH_MS) return 'fresh'
  if (age < STALE_MS) return 'stale'
  return 'expired'
}

export function ageMinutesOf(readAt: string, nowMs = Date.now()): number {
  const parsed = Date.parse(readAt)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.round((nowMs - parsed) / 60_000))
}

const READ_COLUMNS = 'id,created_at,as_of,status,model,read'

export async function fetchLatestRead(): Promise<LiveRead | null> {
  const { data, error } = await supabase.from('market_read_latest').select(READ_COLUMNS).limit(1).maybeSingle()
  if (error) throw new Error(friendlyDbError(error.message))
  if (data === null) return null
  const live = toLiveRead(data)
  if (!live) console.warn('market_read_latest failed validation and was ignored')
  return live
}

export async function fetchReadPayloadById(id: string): Promise<ReadPayload | null> {
  const { data, error } = await supabase.from('market_reads').select(READ_COLUMNS).eq('id', id).limit(1).maybeSingle()
  if (error) throw new Error(friendlyDbError(error.message))
  if (data === null) return null
  return toLiveRead(data)?.read ?? null
}
