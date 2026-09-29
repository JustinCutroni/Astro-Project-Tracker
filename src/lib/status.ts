import type { CaptureStatus, FrameType, ProjectStatus } from '../types/models'

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planning',
  imaging: 'Imaging',
  processing: 'Processing',
  complete: 'Complete',
}

export const PROJECT_STATUS_DOT: Record<ProjectStatus, string> = {
  planning: 'var(--status-planning)',
  imaging: 'var(--status-collecting)',
  processing: 'var(--status-processing)',
  complete: 'var(--status-published)',
}

// Shared between sessions and frames.
export const CAPTURE_STATUS_LABEL: Record<CaptureStatus, string> = {
  planning: 'Planning',
  captured: 'Captured',
  transferred: 'Transferred',
  processing: 'Processing',
  complete: 'Complete',
}

export const CAPTURE_STATUS_DOT: Record<CaptureStatus, string> = {
  planning: 'var(--status-planning)',
  captured: 'var(--status-collecting)',
  transferred: 'var(--status-transferring)',
  processing: 'var(--status-processing)',
  complete: 'var(--status-published)',
}

export const FRAME_TYPE_LABEL: Record<FrameType, string> = {
  light: 'Light',
  dark: 'Dark',
  flat: 'Flat',
  'flat-dark': 'Flat Dark',
  bias: 'Bias',
}
