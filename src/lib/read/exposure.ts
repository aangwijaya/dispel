import { formatPrice, formatQuantity } from '../market/format'
import { getMarket } from '../markets'
import type { Exposure, Setup } from '../../types/read'
import type { Position } from '../../types/trading'

export interface ExposureInput {
  positions: Position[]
  marks: Record<string, string>
  setups: Setup[]
}

export function baseAssetOf(symbol: string): string {
  return symbol.includes('/') ? (symbol.split('/')[0] ?? symbol) : symbol.replace(/USDT$/, '')
}

function parseLevelValue(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Check open positions against the invalidation level of the setup they came from.
 * Positions without a matching setup level are left out.
 */
export function buildExposure({ positions, marks, setups }: ExposureInput): Exposure[] {
  const exposure: Exposure[] = []
  for (const position of positions) {
    const base = baseAssetOf(position.symbol)
    const setup = setups.find((item) => baseAssetOf(item.symbol) === base)
    if (!setup) continue
    const level = parseLevelValue(setup.invalidation.value)
    if (level === null) continue
    const mark = marks[position.symbol] ?? position.avgEntryPrice
    const price = Number(mark)
    const entry = Number(position.avgEntryPrice)
    if (!Number.isFinite(price) || price <= 0) continue

    const market = getMarket(position.symbol)
    const short = setup.bias.toLowerCase().includes('bearish')
    const broken = short ? price > level : price < level
    const cushion = (Math.abs(price - level) / price) * 100
    const status = broken ? 'Invalidated' : cushion < 1 ? 'At risk' : 'Holding'
    const tone = broken ? ('down' as const) : cushion < 1 ? ('caution' as const) : ('neutral' as const)
    const plPct =
      Number.isFinite(entry) && entry > 0 ? ((price - entry) / entry) * 100 * (short ? -1 : 1) : 0

    exposure.push({
      symbol: setup.symbol,
      monogram: setup.monogram,
      status,
      tone,
      holding: `${formatQuantity(position.quantity, market?.quantityPrecision ?? 6)} ${base}`,
      entry: formatPrice(position.avgEntryPrice, market?.pricePrecision ?? 2),
      price: formatPrice(mark, market?.pricePrecision ?? 2),
      changePct: setup.changePct,
      plPct: Number(plPct.toFixed(2)),
      cushionPct: broken ? null : Number(cushion.toFixed(2)),
      summary: setup.summary,
      sees: setup.sees,
      invalidation: setup.invalidation,
      target: setup.target,
      anchors: setup.anchors,
      seed: setup.seed,
    })
  }
  return exposure
}
