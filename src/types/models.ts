// Data model mirrors the existing AppSheet "Astrophotography" schema
// (tables: projects, sessions, frames, cameras, telescopes, mounts, filters)
// so a future sync layer can map onto it without another reshape.

export type ProjectStatus = 'planning' | 'imaging' | 'processing' | 'complete'

export const PROJECT_STATUSES: ProjectStatus[] = [
  'planning',
  'imaging',
  'processing',
  'complete',
]

// Shared by sessions and frames: both can be planned before anything is
// actually shot, and a frame batch under a planned session starts out
// planned too rather than jumping straight to "captured".
export type CaptureStatus = 'planning' | 'captured' | 'transferred' | 'processing' | 'complete'

export const CAPTURE_STATUSES: CaptureStatus[] = [
  'planning',
  'captured',
  'transferred',
  'processing',
  'complete',
]

export type FrameType = 'light' | 'dark' | 'flat' | 'flat-dark' | 'bias'

export const FRAME_TYPES: FrameType[] = ['light', 'dark', 'flat', 'flat-dark', 'bias']

export interface Project {
  id: string
  projectName?: string // friendly name; defaults to target if blank
  target: string // e.g. "M31 - Andromeda Galaxy"
  location?: string // free text, e.g. "Remote Observatory - Utah"
  status: ProjectStatus
  goalHours?: string // free text, e.g. "20+" (matches source app's text field)
  storageRoot?: string // where this project's files live, e.g. "D:\Astro\M31"
  notes?: string
  cameraId?: string
  telescopeId?: string
  mountId?: string
  filterIds: string[] // filters planned for this project
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  projectId: string
  date: string // ISO date - the night of the session
  location?: string // free text
  status: CaptureStatus
  filePath?: string // where this session's raw files currently live
  notes?: string
  // The equipment actually used that night, copied in at the time so the
  // record stays accurate if the catalog entry is later edited, retired or
  // (for old data) removed. `undefined` means a session logged before this
  // existed and not yet backfilled; `{}` means "no gear recorded".
  gear?: SessionGear
  createdAt: string
  updatedAt: string
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
  status: CaptureStatus
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
>
export type TelescopeSnapshot = Pick<Telescope, 'id' | 'description' | 'focalLength'>
export type MountSnapshot = Pick<Mount, 'id' | 'description'>

export interface SessionGear {
  camera?: CameraSnapshot
  telescope?: TelescopeSnapshot
  mount?: MountSnapshot
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
// frames (Dark/Flat/Flat Dark/Bias) don't count toward it.
export function integrationMinutesForFrames(frames: Frame[]): number {
  return (
    frames
      .filter((f) => f.frameType === 'light')
      .reduce((sum, f) => sum + totalExposureSeconds(f), 0) / 60
  )
}
