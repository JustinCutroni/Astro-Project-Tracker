// Core data model for the astrophotography project tracker.
// IDs are strings (uuid) so records can be created offline and merged later.

export type ProjectStatus =
  | 'planning'
  | 'collecting'
  | 'transferring'
  | 'processing'
  | 'published'
  | 'on-hold'

export const PROJECT_STATUSES: ProjectStatus[] = [
  'planning',
  'collecting',
  'transferring',
  'processing',
  'published',
  'on-hold',
]

export interface Project {
  id: string
  target: string // e.g. "M31 - Andromeda Galaxy"
  title?: string // optional friendly name, defaults to target
  goal?: string // what you're trying to achieve (framing, SNR target, mosaic, narrowband palette, etc.)
  status: ProjectStatus
  createdAt: string // ISO date
  updatedAt: string
  targetTotalIntegrationMinutes?: number // planning goal, optional
  notes?: string
  publishedUrl?: string // link to where it was published (Astrobin, Flickr, etc.)
}

export interface Equipment {
  id: string
  name: string // e.g. "8in RC Telescope", "ZWO ASI2600MM Pro"
  type: 'telescope' | 'camera' | 'mount' | 'filter-wheel' | 'other'
  notes?: string
}

export interface FilterDef {
  id: string
  name: string // e.g. "Luminance", "Ha", "OIII", "SII", "Red"
  bandwidthNm?: number
}

export interface Location {
  id: string
  name: string // e.g. "Home Backyard", "Remote Observatory - Utah"
  isRemote: boolean
  bortleClass?: number
  notes?: string
}

// One night (or continuous block) of data collection for a project.
export interface Session {
  id: string
  projectId: string
  date: string // ISO date (the night of the session)
  locationId?: string
  equipmentIds: string[] // telescope/camera/mount used
  exposures: SessionExposure[] // per-filter sub-exposure summary
  seeingNotes?: string
  weatherNotes?: string
  moonIllumination?: number // 0-100 %
  notes?: string
  createdAt: string
  updatedAt: string
}

// Sub-exposure tally for one filter within a session.
export interface SessionExposure {
  filterId: string
  subExposureSeconds: number // length of a single sub, e.g. 300
  subCount: number // number of subs captured
  gain?: number
  binning?: string // e.g. "1x1"
}

export type FileStage =
  | 'on-camera'
  | 'at-observatory'
  | 'transferred-home'
  | 'backed-up'
  | 'processing'
  | 'archived'

// Tracks a batch of data files through the collect -> transfer -> process -> backup pipeline.
export interface DataBatch {
  id: string
  projectId: string
  sessionId?: string
  stage: FileStage
  sizeGb?: number
  fileCount?: number
  location?: string // where the files currently live (drive name, path, cloud folder)
  notes?: string
  createdAt: string
  updatedAt: string
}

export function integrationMinutesForSession(session: Session): number {
  return (
    session.exposures.reduce(
      (sum, e) => sum + e.subExposureSeconds * e.subCount,
      0,
    ) / 60
  )
}
