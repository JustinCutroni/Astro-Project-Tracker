import type { ProjectStatus } from '../types/models'

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planning',
  collecting: 'Collecting',
  transferring: 'Transferring',
  processing: 'Processing',
  published: 'Published',
  'on-hold': 'On hold',
}

export const STATUS_DOT: Record<ProjectStatus, string> = {
  planning: 'var(--status-planning)',
  collecting: 'var(--status-collecting)',
  transferring: 'var(--status-transferring)',
  processing: 'var(--status-processing)',
  published: 'var(--status-published)',
  'on-hold': 'var(--status-onhold)',
}
