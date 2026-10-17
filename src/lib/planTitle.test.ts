import { describe, expect, it } from 'vitest'
import { splitTitle } from './planTitle'

describe('splitTitle', () => {
  it('puts the object in the target and the whole title in the project name', () => {
    expect(splitTitle('NGC 1333 - A Dusty Region in Taurus')).toEqual({
      target: 'NGC 1333 (Reflection Nebula)',
      projectName: 'NGC 1333 - A Dusty Region in Taurus',
    })
  })

  it('handles the other separators people use', () => {
    const expected = { target: 'LBN 472', projectName: 'LBN 472 - A blue echo drifting in cosmic smoke' }
    expect(splitTitle('LBN 472 | A blue echo drifting in cosmic smoke')).toEqual(expected)
    expect(splitTitle('LBN 472: A blue echo drifting in cosmic smoke')).toEqual(expected)
    expect(splitTitle('LBN 472 – A blue echo drifting in cosmic smoke')).toEqual(expected)
    expect(splitTitle('LBN 472 · A blue echo drifting in cosmic smoke')).toEqual(expected)
    expect(splitTitle('LBN 472 A blue echo drifting in cosmic smoke')).toEqual(expected)
  })

  it("uses the app's own wording for a known object", () => {
    expect(splitTitle('M42 - A great night')).toEqual({ target: 'M42 - Orion Nebula', projectName: 'M42 - A great night' })
  })

  it('leaves the project name blank when the title is only the object', () => {
    expect(splitTitle('M42')).toEqual({ target: 'M42 - Orion Nebula', projectName: undefined })
    expect(splitTitle('LBN 472')).toEqual({ target: 'LBN 472', projectName: undefined })
    expect(splitTitle('LBN 472 - ')).toEqual({ target: 'LBN 472', projectName: undefined })
  })

  it('writes a designation the same way however it was typed', () => {
    expect(splitTitle('ngc1333 - x').projectName).toBe('NGC 1333 - x')
    expect(splitTitle('Messier 31 - x').projectName).toBe('M31 - x')
    expect(splitTitle('M031 - x').projectName).toBe('M31 - x')
    expect(splitTitle('Sh2-129 - Flying Bat').projectName).toBe('Sh2-129 - Flying Bat')
    expect(splitTitle('Sharpless 2-129 - Flying Bat').projectName).toBe('Sh2-129 - Flying Bat')
    expect(splitTitle('Sh 2-129 Flying Bat').projectName).toBe('Sh2-129 - Flying Bat')
    expect(splitTitle('vdB 152 - x').projectName).toBe('vdB 152 - x')
    expect(splitTitle('B33 - x').projectName).toBe('Barnard 33 - x')
    expect(splitTitle('Melotte 15 - x').projectName).toBe('Melotte 15 - x')
    expect(splitTitle('Mel 111 Coma Star Cluster')).toEqual({
      target: 'Melotte 111',
      projectName: 'Melotte 111 - Coma Star Cluster',
    })
  })

  it('keeps several objects together, without the catalog wording', () => {
    expect(splitTitle('M42 / IC434 - Orion Nebula, Horsehead and Flame')).toEqual({
      target: 'M42 / IC 434',
      projectName: 'M42 / IC 434 - Orion Nebula, Horsehead and Flame',
    })
    expect(splitTitle('M81 and M82 - Bode\'s Galaxies').target).toBe('M81 / M82')
    expect(splitTitle('NGC 2237 + NGC 2238, The Rosette').target).toBe('NGC 2237 / NGC 2238')
  })

  it('does not take words after a comma for a second object', () => {
    expect(splitTitle('M42, Orion Nebula')).toEqual({ target: 'M42 - Orion Nebula', projectName: 'M42 - Orion Nebula' })
  })

  it('leaves a title with no designation up front exactly as it is', () => {
    expect(splitTitle('Cosmic Dragon')).toEqual({ target: 'Cosmic Dragon' })
    expect(splitTitle('The Orion Nebula (M42)')).toEqual({ target: 'The Orion Nebula (M42)' })
  })

  it('does not mistake the start of an ordinary word for a designation', () => {
    expect(splitTitle('Milky Way core')).toEqual({ target: 'Milky Way core' })
    expect(splitTitle('Bubble Nebula')).toEqual({ target: 'Bubble Nebula' })
    expect(splitTitle('M31andromeda')).toEqual({ target: 'M31andromeda' })
    expect(splitTitle('IC434b')).toEqual({ target: 'IC434b' })
  })

  it('copes with extra spaces, emoji and an empty title', () => {
    expect(splitTitle('   NGC   1333   -   Dusty ✨ Region   ')).toEqual({
      target: 'NGC 1333 (Reflection Nebula)',
      projectName: 'NGC 1333 - Dusty ✨ Region',
    })
    expect(splitTitle('')).toEqual({ target: '' })
    expect(splitTitle('   ')).toEqual({ target: '' })
  })
})
