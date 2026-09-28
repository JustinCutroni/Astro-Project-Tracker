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

// Frames start once something has actually been shot.
export type PipelineStatus = 'captured' | 'transferred' | 'processing' | 'complete'

export const PIPELINE_STATUSES: PipelineStatus[] = [
  'captured',
  'transferred',
  'processing',
  'complete',
]

// Sessions can also be planned before any capturing happens.
export type SessionStatus = 'planning' | PipelineStatus

export const SESSION_STATUSES: SessionStatus[] = [
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
  status: SessionStatus
  filePath?: string // where this session's raw files currently live
  notes?: string
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
  count: number
  exposureSeconds: number
  gain?: number
  offset?: string
  tempF?: number
  binning?: string // e.g. "1x1"
  status: PipelineStatus
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
}

export interface Telescope {
  id: string
  description: string // e.g. "8in RC Telescope"
  focalLength?: string
  dateAdded: string
}

export interface Mount {
  id: string
  description: string
  dateAdded: string
}

export interface FilterDef {
  id: string
  description: string // e.g. "Ha", "L-Extreme"
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
