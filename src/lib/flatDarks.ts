import { newId } from './ids'
import type { Frame } from '../types/models'

// Flat darks calibrate flats, so they're shot at the flat's exposure, gain,
// temperature and filter. Every flat batch gets one built from it.
export function flatDarkFor(flat: Frame, count: number = flat.count): Frame {
  return { ...flat, id: newId(), frameType: 'flat-dark', count }
}

// A flat's exposure is only known once it's captured, so it's usually filled
// in after the flat dark was created from a blank (0s). Flat darks always
// match their flat's exposure, so when a flat's exposure changes, the flat
// darks that still carried its old exposure (same session and filter) follow.
export function flatDarksToResync(before: Frame, after: Frame, sessionFrames: Frame[]): Frame[] {
  if (before.frameType !== 'flat' || before.exposureSeconds === after.exposureSeconds) return []
  return sessionFrames
    .filter(
      (f) =>
        f.frameType === 'flat-dark' &&
        f.filterId === before.filterId &&
        f.exposureSeconds === before.exposureSeconds,
    )
    .map((f) => ({ ...f, exposureSeconds: after.exposureSeconds, updatedAt: after.updatedAt }))
}
