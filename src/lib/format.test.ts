import { describe, expect, it } from 'vitest'
import { formatDeclination, formatRightAscension } from './format'

describe('formatRightAscension', () => {
  it('writes decimal hours as hours, minutes and seconds', () => {
    expect(formatRightAscension(5.5861)).toBe('5h 35m 10s')
    expect(formatRightAscension(0)).toBe('0h 0m 0s')
    expect(formatRightAscension(12.5)).toBe('12h 30m 0s')
  })

  it('rolls over to 0h rather than showing 24h', () => {
    expect(formatRightAscension(23.99999)).toBe('0h 0m 0s')
  })
})

describe('formatDeclination', () => {
  it('writes decimal degrees as degrees, minutes and seconds', () => {
    expect(formatDeclination(-5.1769)).toBe('-5° 10′ 37″')
    expect(formatDeclination(41.2689)).toBe('41° 16′ 8″')
    expect(formatDeclination(0)).toBe('0° 0′ 0″')
  })

  it('keeps the minus sign for a position just south of the equator', () => {
    expect(formatDeclination(-0.5)).toBe('-0° 30′ 0″')
  })

  it('never shows a minus sign for zero', () => {
    expect(formatDeclination(-0.00001)).toBe('0° 0′ 0″')
  })
})
