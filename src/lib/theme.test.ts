import { describe, expect, it } from 'vitest'
import { parseStoredTheme } from './theme'

describe('parseStoredTheme', () => {
  it('uses auto when nothing is stored', () => {
    expect(parseStoredTheme(null, null)).toBe('auto')
  })

  it('returns each valid saved choice', () => {
    expect(parseStoredTheme('auto', null)).toBe('auto')
    expect(parseStoredTheme('light', null)).toBe('light')
    expect(parseStoredTheme('dark', null)).toBe('dark')
    expect(parseStoredTheme('night', null)).toBe('night')
  })

  it('ignores garbage and falls back to auto', () => {
    expect(parseStoredTheme('purple', null)).toBe('auto')
    expect(parseStoredTheme('', null)).toBe('auto')
  })

  it('keeps night mode for people who turned it on before the theme picker existed', () => {
    expect(parseStoredTheme(null, '1')).toBe('night')
  })

  it('does not treat the old "off" value as a choice', () => {
    expect(parseStoredTheme(null, '0')).toBe('auto')
  })

  it('prefers the new setting over the old one', () => {
    expect(parseStoredTheme('light', '1')).toBe('light')
  })
})
