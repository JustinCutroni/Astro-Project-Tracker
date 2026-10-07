import { STATUSES, type Frame, type FrameType, type Project, type Status } from '../types/models'

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

// How far a project is through the whole pipeline (planning -> complete), as
// 0-100. Each light batch counts for its stage (planning 0%, capturing 25%,
// ... complete 100%), weighted by its exposure time, so a project with half
// its light time captured and the rest still planned sits partway through
// capturing rather than jumping stage at once. Calibration frames don't
// weigh in, matching integration time. With no light batches yet it falls
// back to the project's own status; that status also acts as a floor.
export function pipelineProgress(project: Pick<Project, 'status'>, frames: Frame[]): number {
  const last = STATUSES.length - 1
  const floor = STATUSES.indexOf(project.status) / last
  let weighted = 0
  let total = 0
  for (const f of frames) {
    if (f.frameType !== 'light') continue
    const seconds = f.count * f.exposureSeconds
    weighted += seconds * (STATUSES.indexOf(f.status) / last)
    total += seconds
  }
  const fromFrames = total > 0 ? weighted / total : 0
  return Math.round(Math.max(floor, fromFrames) * 100)
}
