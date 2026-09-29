import { sanitizeKlineRow, sanitizeTicker } from '../../../../src/lib/market/binance.ts'
import type { Candle, Ticker } from './types.ts'

/** Parse the `/api/v3/ticker/24hr` payload into sanitized tickers. */
export function parseTickerPayload(raw: unknown): Ticker[] {
  if (!Array.isArray(raw)) throw new Error('invalid_tickers_payload')
  const tickers: Ticker[] = []
  for (const item of raw) {
    const ticker = sanitizeTicker(item)
    if (ticker) tickers.push(ticker)
  }
  return tickers
}

/** Parse the `/api/v3/klines` payload into sanitized candles. */
export function parseKlinePayload(raw: unknown): Candle[] {
  if (!Array.isArray(raw)) throw new Error('invalid_klines_payload')
  const candles: Candle[] = []
  for (const item of raw) {
    const candle = sanitizeKlineRow(item)
    if (candle) candles.push(candle)
  }
  return candles
}

// ───────────────────────── derivatives providers ─────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export interface BinancePremium {
  lastFundingRate: number
  markPrice: number
}

export function parseBinancePremiumIndex(raw: unknown): BinancePremium | null {
  const record = asRecord(raw)
  if (!record) return null
  const lastFundingRate = num(record.lastFundingRate)
  const markPrice = num(record.markPrice)
  if (lastFundingRate === null || markPrice === null || markPrice <= 0) return null
  return { lastFundingRate, markPrice }
}

export function parseBinanceOpenInterest(raw: unknown): number | null {
  const record = asRecord(raw)
  if (!record) return null
  const value = num(record.openInterest)
  return value !== null && value >= 0 ? value : null
}

export interface OiPoint {
  time: number
  openInterestUsd: number
}

export function parseBinanceOiHistory(raw: unknown): OiPoint[] {
  if (!Array.isArray(raw)) return []
  const points: OiPoint[] = []
  for (const item of raw) {
    const record = asRecord(item)
    if (!record) continue
    const time = num(record.timestamp)
    const openInterestUsd = num(record.sumOpenInterestValue)
    if (time === null || openInterestUsd === null || openInterestUsd <= 0) continue
    points.push({ time, openInterestUsd })
  }
  return points.sort((a, b) => a.time - b.time)
}

export interface GateContract {
  fundingRate8h: number
  markPrice: number
  openInterestUsd: number | null
}

export function parseGateContract(raw: unknown): GateContract | null {
  const record = asRecord(raw)
  if (!record) return null
  const fundingRate = num(record.funding_rate)
  const intervalSeconds = num(record.funding_interval) ?? 28_800
  const markPrice = num(record.mark_price)
  if (fundingRate === null || markPrice === null || markPrice <= 0 || intervalSeconds <= 0) return null

  const directUsd = num(record.open_interest_usd)
  let openInterestUsd = directUsd !== null && directUsd > 0 ? directUsd : null
  if (openInterestUsd === null) {
    const openInterest = num(record.open_interest)
    const multiplier = num(record.quanto_multiplier)
    if (openInterest !== null && multiplier !== null && openInterest > 0 && multiplier > 0) {
      openInterestUsd = openInterest * multiplier * markPrice
    }
  }
  return { fundingRate8h: fundingRate * (28_800 / intervalSeconds), markPrice, openInterestUsd }
}

export interface GateStat {
  time: number
  openInterestUsd: number
  longLiqUsd: number
  shortLiqUsd: number
  lsrAccount: number | null
}

export function parseGateStats(raw: unknown): GateStat[] {
  if (!Array.isArray(raw)) return []
  const stats: GateStat[] = []
  for (const item of raw) {
    const record = asRecord(item)
    if (!record) continue
    const time = num(record.time)
    const openInterestUsd = num(record.open_interest_usd)
    if (time === null || openInterestUsd === null || openInterestUsd <= 0) continue
    stats.push({
      time,
      openInterestUsd,
      longLiqUsd: num(record.long_liq_usd) ?? 0,
      shortLiqUsd: num(record.short_liq_usd) ?? 0,
      lsrAccount: num(record.lsr_account),
    })
  }
  return stats.sort((a, b) => a.time - b.time)
}

export interface HlAssetContext {
  coin: string
  fundingHourly: number
  openInterestCoins: number
  markPx: number
}

export function parseHyperliquidMeta(raw: unknown): HlAssetContext[] {
  if (!Array.isArray(raw) || raw.length < 2) return []
  const meta = asRecord(raw[0])
  const contexts = raw[1]
  if (!meta || !Array.isArray(meta.universe) || !Array.isArray(contexts)) return []
  const out: HlAssetContext[] = []
  for (let index = 0; index < meta.universe.length; index++) {
    const entry = asRecord(meta.universe[index])
    const context = asRecord(contexts[index])
    if (!entry || !context || typeof entry.name !== 'string') continue
    const fundingHourly = num(context.funding)
    const openInterestCoins = num(context.openInterest)
    const markPx = num(context.markPx)
    if (fundingHourly === null || openInterestCoins === null || markPx === null || markPx <= 0) continue
    out.push({ coin: entry.name, fundingHourly, openInterestCoins, markPx })
  }
  return out
}

export function parseHyperliquidFunding(raw: unknown): Array<{ time: number; rateHourly: number }> {
  if (!Array.isArray(raw)) return []
  const out: Array<{ time: number; rateHourly: number }> = []
  for (const item of raw) {
    const record = asRecord(item)
    if (!record) continue
    const time = num(record.time)
    const rateHourly = num(record.fundingRate)
    if (time === null || rateHourly === null) continue
    out.push({ time, rateHourly })
  }
  return out.sort((a, b) => a.time - b.time)
}

// ───────────────────────── on-chain providers ─────────────────────────

export interface CoinMetricsDay {
  asset: string
  date: string
  values: Record<string, number>
}

const CM_INTERNAL_KEYS = new Set(['asset', 'time', '-status'])

export function parseCoinMetrics(raw: unknown): CoinMetricsDay[] {
  const root = asRecord(raw)
  if (!root || !Array.isArray(root.data)) return []
  const days: CoinMetricsDay[] = []
  for (const item of root.data) {
    const record = asRecord(item)
    if (!record) continue
    if (typeof record.asset !== 'string' || typeof record.time !== 'string') continue
    if (record['-status'] === 'flash') continue
    const values: Record<string, number> = {}
    for (const [key, value] of Object.entries(record)) {
      if (CM_INTERNAL_KEYS.has(key)) continue
      const parsed = num(value)
      if (parsed !== null) values[key] = parsed
    }
    const date = record.time.slice(0, 10)
    days.push({ asset: record.asset, date, values })
  }
  return days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export function parseDefiLlamaStablecoins(raw: unknown): Array<{ date: string; totalUsd: number }> {
  if (!Array.isArray(raw)) return []
  const out: Array<{ date: string; totalUsd: number }> = []
  for (const item of raw) {
    const record = asRecord(item)
    if (!record || typeof record.date !== 'string') continue
    const totalRecord =
      asRecord(record.totalCirculatingUSD) ?? asRecord(record.totalCirculating) ?? asRecord(record.total)
    const total = totalRecord ? num(totalRecord.peggedUSD) : num(record.total)
    if (total === null || total <= 0) continue
    const seconds = Number(record.date)
    const date = Number.isFinite(seconds)
      ? new Date(seconds * 1000).toISOString().slice(0, 10)
      : record.date.slice(0, 10)
    out.push({ date, totalUsd: total })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export function parseMempoolFees(raw: unknown): number | null {
  const record = asRecord(raw)
  if (!record) return null
  const fastest = num(record.fastestFee)
  return fastest !== null && fastest > 0 ? fastest : null
}

export function parseMempoolStats(raw: unknown): number | null {
  const record = asRecord(raw)
  if (!record) return null
  const count = num(record.count)
  return count !== null && count >= 0 ? count : null
}
