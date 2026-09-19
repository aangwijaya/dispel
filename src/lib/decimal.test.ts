import { describe, expect, it } from 'vitest'
import { add, dec, div, mul, percentChange, sub, toFixedDown } from './decimal'

describe('decimal arithmetic', () => {
  it('avoids naive floating point errors', () => {
    expect(add('0.1', '0.2')).toBe('0.3')
    expect(mul('0.1', '0.2')).toBe('0.02')
    expect(sub('1', '0.9')).toBe('0.1')
  })

  it('handles large crypto values', () => {
    expect(mul('64000.12345678', '123456.78901234')).toBe('7901249738.3674006028766652')
  })
})

describe('rounding helpers', () => {
  it('truncates toward zero with toFixedDown', () => {
    expect(toFixedDown('1.999', 2)).toBe('1.99')
    expect(toFixedDown('0.000000019', 8)).toBe('0.00000001')
  })

  it('divides exactly', () => {
    expect(div('1', '8')).toBe('0.125')
  })
})

describe('percentChange', () => {
  it('computes signed percentages', () => {
    expect(percentChange('100', '110')).toBe('10.00')
    expect(percentChange('100', '90')).toBe('-10.00')
  })

  it('returns null when the base is zero', () => {
    expect(percentChange('0', '10')).toBeNull()
  })
})

describe('comparisons', () => {
  it('compares as decimals, not floats', () => {
    expect(dec('0.3').eq(dec('0.1').plus(dec('0.2')))).toBe(true)
  })
})
