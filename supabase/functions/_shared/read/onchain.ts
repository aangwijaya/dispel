import type { CoinMetricsDay } from './marketData.ts'
import type { OnchainAssetFacts, OnchainFacts } from './types.ts'

const DAY_MS = 86_400_000

export interface OnchainInput {
  asOf: string
  btcDays: CoinMetricsDay[]
  ethDays: CoinMetricsDay[]
  defillama: Array<{ date: string; totalUsd: number }> | null
  mempool: { txCount: number; fastestFee: number } | null
  previousFees: Array<{ asOf: string; fee: number }>
}

function round(value: number, dp = 2): number {
  const factor = 10 ** dp
  return Math.round(value * factor) / factor
}

function pctChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null
  return ((to - from) / Math.abs(from)) * 100
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((total, value) => total + value, 0) / values.length
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? null
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

function netflow(day: CoinMetricsDay): number | null {
  const inflow = day.values.FlowInExNtv
  const outflow = day.values.FlowOutExNtv
  if (inflow === undefined || outflow === undefined) return null
  return inflow - outflow
}

function assetFacts(days: CoinMetricsDay[]): OnchainAssetFacts | null {
  const latest = days.at(-1)
  if (!latest) return null
  const today = netflow(latest)
  if (today === null) return null

  const window = days.slice(-30)
  const flows = window.map((day) => netflow(day)).filter((value): value is number => value !== null)
  if (flows.length === 0) return null

  const sevenDay = days.slice(-7).map((day) => netflow(day)).filter((value): value is number => value !== null)
  const average30 = mean(flows)
  const supplyNow = latest.values.SplyExNtv
  const supplyOld = window[0]?.values.SplyExNtv
  const supplyChange = supplyNow === undefined || supplyOld === undefined ? null : pctChange(supplyOld, supplyNow)
  const activeNow = latest.values.AdrActCnt
  const activeAvg = mean(window.map((day) => day.values.AdrActCnt ?? Number.NaN).filter(Number.isFinite))

  return {
    netflow_ntv_today: round(today, 2),
    netflow_ntv_7d_sum: round(sevenDay.reduce((total, value) => total + value, 0), 2),
    netflow_today_vs_30d_avg_pct:
      average30 === null || average30 === 0 ? null : round(((today - average30) / Math.abs(average30)) * 100, 1),
    exchange_supply_30d_change_pct: supplyChange === null ? null : round(supplyChange, 2),
    active_addresses_vs_30d_avg_pct:
      activeNow === undefined || activeAvg === null || activeAvg === 0 ? null : round(((activeNow - activeAvg) / activeAvg) * 100, 1),
  }
}

function stablecoinFacts(defillama: Array<{ date: string; totalUsd: number }> | null): {
  supply: number | null
  change7d: number | null
  change30d: number | null
} {
  if (!defillama || defillama.length < 2) return { supply: null, change7d: null, change30d: null }
  const latest = defillama.at(-1)
  if (!latest) return { supply: null, change7d: null, change30d: null }
  const at = (back: number): number | null => defillama[defillama.length - 1 - back]?.totalUsd ?? null
  const week = at(7)
  const month = at(30) ?? defillama[0]?.totalUsd ?? null
  return {
    supply: Math.round(latest.totalUsd),
    change7d: week === null ? null : round(pctChange(week, latest.totalUsd) ?? 0, 2),
    change30d: month === null ? null : round(pctChange(month, latest.totalUsd) ?? 0, 2),
  }
}

export function computeOnchain(input: OnchainInput): OnchainFacts | null {
  const btc = assetFacts(input.btcDays)
  const eth = assetFacts(input.ethDays)
  if (!btc || !eth) return null

  const asOfDate = input.btcDays.at(-1)?.date ?? input.ethDays.at(-1)?.date
  if (!asOfDate) return null

  let mempool: OnchainFacts['btc_mempool'] = null
  if (input.mempool) {
    const cutoff = Date.parse(input.asOf) - 7 * DAY_MS
    const fees = input.previousFees
      .filter((sample) => Date.parse(sample.asOf) >= cutoff)
      .map((sample) => sample.fee)
    const medianFee = fees.length >= 5 ? median(fees) : null
    mempool = {
      tx_count: Math.round(input.mempool.txCount),
      fastest_fee_sat_vb: round(input.mempool.fastestFee, 1),
      fastest_fee_vs_7d_median_pct:
        medianFee === null || medianFee === 0
          ? null
          : round(((input.mempool.fastestFee - medianFee) / medianFee) * 100, 1),
    }
  }

  const stablecoins = stablecoinFacts(input.defillama)

  return {
    as_of_date: asOfDate,
    btc,
    eth,
    stablecoin_supply_usd: stablecoins.supply,
    stablecoin_supply_7d_change_pct: stablecoins.change7d,
    stablecoin_supply_30d_change_pct: stablecoins.change30d,
    btc_mempool: mempool,
  }
}
