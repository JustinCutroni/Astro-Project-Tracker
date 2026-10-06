import type { FrameType, Status } from '../types/models'

export const STATUS_LABEL: Record<Status, string> = {
  planning: 'Planning',
  capturing: 'Capturing',
  transferring: 'Transferring',
  processing: 'Processing',
  complete: 'Complete',
}

export const STATUS_DOT: Record<Status, string> = {
  planning: 'var(--status-planning)',
  capturing: 'var(--status-collecting)',
  transferring: 'var(--status-transferring)',
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
