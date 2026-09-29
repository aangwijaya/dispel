import { BIAS_LABEL, regimeAt } from './demo'
import type { ReadPayload, SinceRow } from '../../types/read'

/**
 * Diff between the read the user last saw and the current one.
 * Produces at most four rows: bias, risk, regime (only when it changed) and setup moves.
 */
export function diffReads(previous: ReadPayload, current: ReadPayload): SinceRow[] {
  const rows: SinceRow[] = []

  rows.push(
    previous.bias === current.bias
      ? { kind: 'same', label: 'Bias', text: `${current.bias}, unchanged` }
      : { kind: 'chg', label: 'Bias', text: `${previous.bias} → ${current.bias}` },
  )

  const previousRisk = BIAS_LABEL[previous.stats.risk] ?? '—'
  const currentRisk = BIAS_LABEL[current.stats.risk] ?? '—'
  rows.push(
    previousRisk === currentRisk
      ? { kind: 'same', label: 'Risk', text: `${currentRisk}, unchanged` }
      : { kind: 'chg', label: 'Risk', text: `${previousRisk} → ${currentRisk}` },
  )

  if (previous.regimeIndex !== current.regimeIndex) {
    rows.push({
      kind: 'chg',
      label: 'Regime',
      text: `${regimeAt(previous.regimeIndex).name} → ${regimeAt(current.regimeIndex).name}`,
    })
  }

  const previousSetups = new Set(previous.setups.map((setup) => setup.monogram))
  const currentSetups = new Set(current.setups.map((setup) => setup.monogram))
  for (const setup of current.setups.filter((item) => !previousSetups.has(item.monogram)).slice(0, 2)) {
    rows.push({ kind: 'new', label: 'Setup', text: `${setup.monogram} added` })
  }
  for (const setup of previous.setups.filter((item) => !currentSetups.has(item.monogram)).slice(0, 2)) {
    rows.push({ kind: 'end', label: 'Setup', text: `${setup.monogram} removed` })
  }

  return rows.slice(0, 4)
}

export function changedCount(rows: SinceRow[]): number {
  return rows.filter((row) => row.kind !== 'same').length
}
