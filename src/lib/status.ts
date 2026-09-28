import type { FrameType, PipelineStatus, ProjectStatus, SessionStatus } from '../types/models'

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

export const PIPELINE_STATUS_LABEL: Record<PipelineStatus, string> = {
  captured: 'Captured',
  transferred: 'Transferred',
  processing: 'Processing',
  complete: 'Complete',
}

export const PIPELINE_STATUS_DOT: Record<PipelineStatus, string> = {
  captured: 'var(--status-collecting)',
  transferred: 'var(--status-transferring)',
  processing: 'var(--status-processing)',
  complete: 'var(--status-published)',
}

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  planning: 'Planning',
  ...PIPELINE_STATUS_LABEL,
}

export const SESSION_STATUS_DOT: Record<SessionStatus, string> = {
  planning: 'var(--status-planning)',
  ...PIPELINE_STATUS_DOT,
}

export const FRAME_TYPE_LABEL: Record<FrameType, string> = {
  light: 'Light',
  dark: 'Dark',
  flat: 'Flat',
  'flat-dark': 'Flat Dark',
  bias: 'Bias',
}
