import { describe, expect, it } from 'vitest'
import { matchFilter, matchGear } from './planMatch'

const filter = (description: string, retiredAt?: string) => ({ id: description, description, dateAdded: '2020-01-01', retiredAt })
const catalog = ['L', 'R', 'G', 'B', 'S', 'Ha', 'OIII', 'L-Enhance'].map((d) => filter(d))

describe('matchFilter', () => {
  it('matches ignoring case, spaces and punctuation', () => {
    expect(matchFilter('ha', catalog)?.id).toBe('Ha')
    expect(matchFilter('[OIII]', catalog)?.id).toBe('OIII')
  })

  it('understands common alternative names', () => {
    expect(matchFilter('Lum / Clear', catalog)?.id).toBe('L')
    expect(matchFilter('Lum/Clear', catalog)?.id).toBe('L')
    expect(matchFilter('Luminance', catalog)?.id).toBe('L')
    expect(matchFilter('Red', catalog)?.id).toBe('R')
    expect(matchFilter('Hα', catalog)?.id).toBe('Ha')
    expect(matchFilter('H-alpha', catalog)?.id).toBe('Ha')
    expect(matchFilter('O3', catalog)?.id).toBe('OIII')
    expect(matchFilter('SII', catalog)?.id).toBe('S')
  })

  it('prefers an exact catalog name over an alias', () => {
    const withSii = [...catalog, filter('SII')]
    expect(matchFilter('SII', withSii)?.id).toBe('SII')
  })

  it('never matches part of a longer name', () => {
    expect(matchFilter('Enhance', catalog)).toBeUndefined()
    expect(matchFilter('L-Extreme', catalog)).toBeUndefined()
  })

  it('leaves unknown, empty and symbol-only names unmatched', () => {
    expect(matchFilter('Mystery', catalog)).toBeUndefined()
    expect(matchFilter('', catalog)).toBeUndefined()
    expect(matchFilter('---', catalog)).toBeUndefined()
  })

  it('never offers a retired filter', () => {
    expect(matchFilter('Ha', [filter('Ha', '2024-01-01')])).toBeUndefined()
  })
})

describe('matchGear', () => {
  const items = [
    { id: 'a', description: 'ZWO ASI2600MM Pro', dateAdded: '2020-01-01' },
    { id: 'b', description: 'ASI294MC', dateAdded: '2020-01-01' },
    { id: 'c', description: 'Old camera', dateAdded: '2020-01-01', retiredAt: '2024-01-01' },
  ]

  it('matches when one name contains the other', () => {
    expect(matchGear('ASI2600MM Pro', items)?.id).toBe('a')
    expect(matchGear('ZWO ASI2600MM Pro Cooled Camera', items)?.id).toBe('a')
  })

  it('prefers an exact match', () => {
    const more = [...items, { id: 'd', description: 'ASI294MC Pro', dateAdded: '2020-01-01' }]
    expect(matchGear('ASI294MC', more)?.id).toBe('b')
  })

  it('does not match tiny names, nothing, or retired gear', () => {
    expect(matchGear('AS', items)).toBeUndefined()
    expect(matchGear('', items)).toBeUndefined()
    expect(matchGear('Old camera', items)).toBeUndefined()
    expect(matchGear('Canon', items)).toBeUndefined()
  })
})
