import { newId } from './ids'
import type { Frame } from '../types/models'

// Flat darks calibrate flats, so they're shot at the flat's exposure, gain,
// temperature and filter. Every flat batch gets one built from it.
export function flatDarkFor(flat: Frame, count: number = flat.count): Frame {
  return { ...flat, id: newId(), frameType: 'flat-dark', count }
}
