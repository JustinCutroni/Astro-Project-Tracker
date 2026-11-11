import { describe, expect, it } from 'vitest'
import { hasPreviousScreen } from './useGoBack'

describe('hasPreviousScreen', () => {
  it('is false on the first screen of a visit', () => {
    expect(hasPreviousScreen('default')).toBe(false)
  })

  it('is true after navigating within the app', () => {
    expect(hasPreviousScreen('k3j9x2')).toBe(true)
  })
})
