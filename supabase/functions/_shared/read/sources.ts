/**
 * External market-data sources for the derivatives and on-chain facts.
 * Pure data: endpoint definitions, symbol mappings and probe report types.
 * I/O lives in the Edge Function (probe.ts / index.ts).
 */

const BINANCE_FUTURES = 'https://fapi.binance.com'
const GATE_FUTURES = 'https://api.gateio.ws/api/v4'
const HYPERLIQUID = 'https://api.hyperliquid.xyz'
const COINMETRICS = 'https://community-api.coinmetrics.io/v4'
const DEFILLAMA = 'https://stablecoins.llama.fi'
const MEMPOOL = 'https://mempool.space'

export const COINMETRICS_MARKET_METRICS = ['FlowInExNtv', 'FlowOutExNtv', 'SplyExNtv', 'AdrActCnt'] as const

export function binancePremiumIndex(symbol: string): string {
  return `${BINANCE_FUTURES}/fapi/v1/premiumIndex?symbol=${symbol}`
}

export function binanceOpenInterest(symbol: string): string {
  return `${BINANCE_FUTURES}/fapi/v1/openInterest?symbol=${symbol}`
}

export function binanceOpenInterestHistory(symbol: string, limit = 25): string {
  return `${BINANCE_FUTURES}/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=${limit}`
}

/** Gate futures contract id for a base asset, e.g. BTC -> BTC_USDT. */
export function gateContract(base: string): string {
  return `${base}_USDT`
}

export function gateContractUrl(base: string): string {
  return `${GATE_FUTURES}/futures/usdt/contracts/${gateContract(base)}`
}

export function gateContractStatsUrl(base: string, limit = 25): string {
  return `${GATE_FUTURES}/futures/usdt/contract_stats?contract=${gateContract(base)}&interval=1h&limit=${limit}`
}

export const HYPERLIQUID_INFO_URL = `${HYPERLIQUID}/info`

/** Hyperliquid uses bare coin names (BTC, ETH, SOL). */
export function hyperliquidCoin(base: string): string {
  return base
}

export function hyperliquidFundingHistoryBody(base: string, startTimeMs: number): unknown {
  return { type: 'fundingHistory', coin: hyperliquidCoin(base), startTime: startTimeMs }
}

export function coinmetricsMetricsUrl(assets: string[], metrics: readonly string[], pageSize = 35): string {
  const query = new URLSearchParams({
    assets: assets.join(','),
    metrics: metrics.join(','),
    frequency: '1d',
    page_size: String(pageSize),
    paging_from: 'end',
  })
  return `${COINMETRICS}/timeseries/asset-metrics?${query.toString()}`
}

export const STABLECOIN_CHARTS_URL = `${DEFILLAMA}/stablecoincharts/all`
export const MEMPOOL_FEES_URL = `${MEMPOOL}/api/v1/fees/recommended`
export const MEMPOOL_STATS_URL = `${MEMPOOL}/api/mempool`

export interface ProbeCheckResult {
  ok: boolean
  http_status: number | null
  latency_ms: number
  error?: string
}

export interface ProbeSourceReport {
  ok: boolean
  checks: Record<string, ProbeCheckResult>
}

export type ProbeReport = Record<string, ProbeSourceReport>

export interface SourceCheck {
  name: string
  url: string
  method: 'GET' | 'POST'
  body?: (nowMs: number) => unknown
}

export interface ProbeSource {
  id: string
  label: string
  checks: SourceCheck[]
}

export const PROBE_SOURCES: ProbeSource[] = [
  {
    id: 'binance_futures',
    label: 'Binance USDⓈ-M futures',
    checks: [
      { name: 'premiumIndex', url: binancePremiumIndex('BTCUSDT'), method: 'GET' },
      { name: 'openInterest', url: binanceOpenInterest('BTCUSDT'), method: 'GET' },
      { name: 'oiHistory', url: binanceOpenInterestHistory('BTCUSDT'), method: 'GET' },
    ],
  },
  {
    id: 'gate_futures',
    label: 'Gate.io USDT futures',
    checks: [
      { name: 'contract', url: gateContractUrl('BTC'), method: 'GET' },
      { name: 'contractStats', url: gateContractStatsUrl('BTC'), method: 'GET' },
    ],
  },
  {
    id: 'hyperliquid',
    label: 'Hyperliquid perps',
    checks: [
      { name: 'metaAndAssetCtxs', url: HYPERLIQUID_INFO_URL, method: 'POST', body: () => ({ type: 'metaAndAssetCtxs' }) },
      {
        name: 'fundingHistory',
        url: HYPERLIQUID_INFO_URL,
        method: 'POST',
        body: (nowMs) => hyperliquidFundingHistoryBody('BTC', nowMs - 25 * 3_600_000),
      },
    ],
  },
  {
    id: 'coinmetrics',
    label: 'Coin Metrics Community',
    checks: [
      {
        name: 'marketMetrics',
        url: coinmetricsMetricsUrl(['btc', 'eth'], COINMETRICS_MARKET_METRICS),
        method: 'GET',
      },
      {
        name: 'stablecoinSupply',
        url: coinmetricsMetricsUrl(['usdt', 'usdc'], ['SplyCur']),
        method: 'GET',
      },
    ],
  },
  {
    id: 'defillama',
    label: 'DefiLlama stablecoins',
    checks: [{ name: 'stablecoinCharts', url: STABLECOIN_CHARTS_URL, method: 'GET' }],
  },
  {
    id: 'mempool',
    label: 'mempool.space',
    checks: [
      { name: 'fees', url: MEMPOOL_FEES_URL, method: 'GET' },
      { name: 'stats', url: MEMPOOL_STATS_URL, method: 'GET' },
    ],
  },
]
