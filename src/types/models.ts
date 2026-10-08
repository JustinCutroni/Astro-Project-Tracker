// Data model mirrors the existing AppSheet "Astrophotography" schema
// (tables: projects, sessions, frames, cameras, telescopes, mounts, filters)
// so a future sync layer can map onto it without another reshape.

// One status vocabulary for projects, sessions and frame batches, in pipeline
// order. Status moves down (changing a session updates its frames) and up
// (a parent advances once all of its children have) - see lib/statusSync.ts.
export type Status = 'planning' | 'capturing' | 'transferring' | 'processing' | 'complete'

export const STATUSES: Status[] = ['planning', 'capturing', 'transferring', 'processing', 'complete']

export type FrameType = 'light' | 'dark' | 'flat' | 'flat-dark' | 'bias'

export const FRAME_TYPES: FrameType[] = ['light', 'dark', 'flat', 'flat-dark', 'bias']

export interface Project {
  id: string
  projectName?: string // friendly name; defaults to target if blank
  target: string // e.g. "M31 - Andromeda Galaxy"
  status: Status
  goalHours?: string // free text, e.g. "20+" (matches source app's text field)
  notes?: string
  // Equipment lives on sessions, not here: a project can use a different rig
  // from one night to the next.
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  projectId: string
  date: string // ISO date - the night of the session
  location?: string // free text
  status: Status
  filePath?: string // where this session's raw files currently live
  notes?: string
  // The equipment (mount, scope, camera, filters) used or planned for that
  // night, copied in at the time so the record stays accurate if the catalog
  // entry is later edited or retired. Its frame batches draw their filters and
  // defaults from here. `{}` means "no gear recorded".
  gear?: SessionGear
  createdAt: string
  updatedAt: string
}

// A raw log file (e.g. an ASIAIR Autorun log) kept with a session. The file is
// stored byte-for-byte, gzipped and base64-encoded so it fits in a Firestore
// document; see lib/logStore.ts. It lives in its own collection so listing
// sessions never has to download log contents.
export interface SessionLog {
  id: string
  sessionId: string
  projectId: string
  fileName: string
  sizeBytes: number // original, uncompressed size
  encoding: 'gzip-base64'
  data: string
  importedAt: string
}

// One batch of subs of a single type/filter/settings combo within a session.
export interface Frame {
  id: string
  sessionId: string
  projectId: string
  frameType: FrameType
  filterId?: string // not set for bias/some calibration frames
  filterName?: string // the filter's name when the batch was logged; survives edits/removal
  count: number
  exposureSeconds: number
  gain?: number
  offset?: string
  tempF?: number
  binning?: string // e.g. "1x1"
  status: Status
  filePathPattern?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Camera {
  id: string
  description: string // e.g. "ZWO ASI2600MM Pro"
  cameraType?: string // free text for now (source app's Enum options aren't captured yet)
  dateAdded: string
  // Auto-filled from the camera catalog when the description matches a known
  // model, but always editable - the catalog is a starting point, not a lock.
  sensorWidthMm?: number
  sensorHeightMm?: number
  pixelSizeUm?: number
  resolutionWidthPx?: number
  resolutionHeightPx?: number
  sensorType?: 'Mono' | 'Color'
  defaultGain?: number // the manufacturer's published "optimal"/unity gain
  retiredAt?: string // set when sold/retired: hidden from pickers, kept for history
}

export interface Telescope {
  id: string
  description: string // e.g. "8in RC Telescope"
  focalLength?: string
  dateAdded: string
  retiredAt?: string
}

export interface Mount {
  id: string
  description: string
  dateAdded: string
  retiredAt?: string
}

export interface FilterDef {
  id: string
  description: string // e.g. "Ha", "L-Extreme"
  position?: number // filter wheel slot, 1-based
  dateAdded: string
  retiredAt?: string
}

// Gear is never hard-deleted once something refers to it. Retiring (selling,
// replacing) hides it from pickers but keeps it resolvable for history.
export interface Retirable {
  id: string
  retiredAt?: string
}

// Point-in-time copies of the gear fields worth showing, stored on a session.
// They keep the catalog id so a snapshot can still be matched to its entry.
export type CameraSnapshot = Pick<
  Camera,
  | 'id'
  | 'description'
  | 'cameraType'
  | 'sensorWidthMm'
  | 'sensorHeightMm'
  | 'pixelSizeUm'
  | 'resolutionWidthPx'
  | 'resolutionHeightPx'
  | 'sensorType'
  | 'defaultGain'
>
export type TelescopeSnapshot = Pick<Telescope, 'id' | 'description' | 'focalLength'>
export type MountSnapshot = Pick<Mount, 'id' | 'description'>
export type FilterSnapshot = Pick<FilterDef, 'id' | 'description' | 'position'>

export interface SessionGear {
  camera?: CameraSnapshot
  telescope?: TelescopeSnapshot
  mount?: MountSnapshot
  filters?: FilterSnapshot[]
}

export interface Location {
  id: string
  description: string // e.g. "Remote Observatory - Utah"
  dateAdded: string
}

export function totalExposureSeconds(frame: Pick<Frame, 'count' | 'exposureSeconds'>): number {
  return frame.count * frame.exposureSeconds
}

// Only Light frames represent integration time on the target; calibration
// frames (Dark/Flat/Flat Dark/Bias) don't count toward it. Batches still in
// 'planning' haven't been captured yet, so they don't count either.
export function integrationMinutesForFrames(frames: Frame[]): number {
  return lightMinutes(frames.filter((f) => f.status !== 'planning'))
}

// The whole plan: every light batch, captured or not. Captured time is a
// subset of this, so captured / planned is how far along the plan is.
export function plannedIntegrationMinutesForFrames(frames: Frame[]): number {
  return lightMinutes(frames)
}

function lightMinutes(frames: Frame[]): number {
  return (
    frames
      .filter((f) => f.frameType === 'light')
      .reduce((sum, f) => sum + totalExposureSeconds(f), 0) / 60
  )
}
