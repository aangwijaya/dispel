// Chart indicators shared by the trade chart and the market-read Edge Function, so the lines a
// trader sees match the facts Jev is given. Entries are null until a period has enough history.

export type Series = Array<number | null>

/** Simple moving average of the last `period` values. */
export function sma(values: number[], period: number): Series {
  const out: Series = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i] ?? 0
    if (i >= period) sum -= values[i - period] ?? 0
    out.push(i >= period - 1 ? sum / period : null)
  }
  return out
}

/** Exponential moving average, seeded with the SMA of the first `period` values (TradingView-style). */
export function ema(values: number[], period: number): Series {
  const k = 2 / (period + 1)
  const out: Series = []
  let prev = 0
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null)
      continue
    }
    if (i === period - 1) {
      let sum = 0
      for (let j = 0; j < period; j++) sum += values[j] ?? 0
      prev = sum / period
    } else {
      prev = (values[i] ?? 0) * k + prev * (1 - k)
    }
    out.push(prev)
  }
  return out
}

/** Wilder's RSI. The first value appears at index `period`. */
export function rsi(values: number[], period = 14): Series {
  const out: Series = values.map(() => null)
  if (values.length <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const diff = (values[i] ?? 0) - (values[i - 1] ?? 0)
    if (diff >= 0) gain += diff
    else loss -= diff
  }
  gain /= period
  loss /= period
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  for (let i = period + 1; i < values.length; i++) {
    const diff = (values[i] ?? 0) - (values[i - 1] ?? 0)
    gain = (gain * (period - 1) + (diff > 0 ? diff : 0)) / period
    loss = (loss * (period - 1) + (diff < 0 ? -diff : 0)) / period
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  }
  return out
}
