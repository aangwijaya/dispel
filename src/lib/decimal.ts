import Decimal from 'decimal.js'

Decimal.set({ precision: 40 })

export type DecimalValue = string | number | Decimal

export function dec(value: DecimalValue): Decimal {
  return new Decimal(value)
}

export function mul(a: DecimalValue, b: DecimalValue): string {
  return dec(a).mul(dec(b)).toString()
}

export function div(a: DecimalValue, b: DecimalValue): string {
  return dec(a).div(dec(b)).toString()
}

export function add(a: DecimalValue, b: DecimalValue): string {
  return dec(a).plus(dec(b)).toString()
}

export function sub(a: DecimalValue, b: DecimalValue): string {
  return dec(a).minus(dec(b)).toString()
}

export function gt(a: DecimalValue, b: DecimalValue): boolean {
  return dec(a).gt(dec(b))
}

export function lt(a: DecimalValue, b: DecimalValue): boolean {
  return dec(a).lt(dec(b))
}

export function gte(a: DecimalValue, b: DecimalValue): boolean {
  return dec(a).gte(dec(b))
}

export function lte(a: DecimalValue, b: DecimalValue): boolean {
  return dec(a).lte(dec(b))
}

export function toFixed(value: DecimalValue, decimals: number): string {
  return dec(value).toFixed(decimals, Decimal.ROUND_HALF_UP)
}

export function toFixedDown(value: DecimalValue, decimals: number): string {
  return dec(value).toFixed(decimals, Decimal.ROUND_DOWN)
}

export function percentChange(from: DecimalValue, to: DecimalValue): string | null {
  if (!dec(from).gt(0)) return null
  return dec(to).minus(from).div(from).mul(100).toFixed(2)
}
