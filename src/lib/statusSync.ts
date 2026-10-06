import { bulkMerge, getAllFromServer, getOne, getWhere, putDoc } from '../firebase/firestoreDb'
import { nowIso } from './ids'
import { STATUSES, type Frame, type Project, type Session, type Status } from '../types/models'

// Status flows two ways through project -> session -> frame:
//
// - Down, when you change a session by hand: its frames follow (see
//   cascadeStatus).
// - Up, automatically: a session advances once *every* one of its frames has
//   reached the next stage, and a project once every session has (see
//   rollUpSession / rollUpProject). Up only ever moves forward - a session
//   you've left planned (bad weather) or a freshly added planned batch holds
//   its parent where it is rather than dragging it back.

export function statusRank(status: Status): number {
  return STATUSES.indexOf(status)
}

// The least-advanced status among the items, or undefined if there are none.
export function earliestStatus(items: { status: Status }[]): Status | undefined {
  return items.reduce<Status | undefined>(
    (earliest, item) => (earliest === undefined || statusRank(item.status) < statusRank(earliest) ? item.status : earliest),
    undefined,
  )
}

// Children (a session's frames) that must change when their parent moves from
// one status to another. Moving forward brings laggards up to the new status
// and leaves any that are already ahead alone; moving backward pulls back
// anything that's further along than the new status.
export function cascadeStatus<T extends { status: Status; updatedAt: string }>(
  children: T[],
  from: Status,
  to: Status,
): T[] {
  const forward = statusRank(to) > statusRank(from)
  return children
    .filter((c) => (forward ? statusRank(c.status) < statusRank(to) : statusRank(c.status) > statusRank(to)))
    .map((c) => ({ ...c, status: to, updatedAt: nowIso() }))
}

// Overlays just-made changes onto what was read, since writes are fire-and-
// forget and a read right after one may not reflect it yet.
function overlay<T extends { id: string }>(items: T[], put: T[], removedIds: string[]): T[] {
  const putIds = new Set(put.map((p) => p.id))
  return [...items.filter((i) => !putIds.has(i.id) && !removedIds.includes(i.id)), ...put]
}

interface Changes<T> {
  put?: T[]
  removedIds?: string[]
}

// A session's frames just changed: advance the session (and, through it, the
// project) if every frame is now ahead of it.
export async function rollUpSession(
  sessionId: string,
  projectId: string,
  { put = [], removedIds = [] }: Changes<Frame> = {},
): Promise<void> {
  const [frames, session] = await Promise.all([
    getWhere<Frame>('frames', 'sessionId', sessionId),
    getOne<Session>('sessions', sessionId),
  ])
  if (!session) return
  const earliest = earliestStatus(overlay(frames, put, removedIds))
  if (earliest === undefined || statusRank(earliest) <= statusRank(session.status)) return

  const advanced: Session = { ...session, status: earliest, updatedAt: nowIso() }
  await putDoc<Session>('sessions', advanced)
  await rollUpProject(projectId, { put: [advanced] })
}

// A project's sessions just changed: advance the project if every session is
// now ahead of it.
export async function rollUpProject(
  projectId: string,
  { put = [], removedIds = [] }: Changes<Session> = {},
): Promise<void> {
  const [sessions, project] = await Promise.all([
    getWhere<Session>('sessions', 'projectId', projectId),
    getOne<Project>('projects', projectId),
  ])
  if (!project) return
  const earliest = earliestStatus(overlay(sessions, put, removedIds))
  if (earliest === undefined || statusRank(earliest) <= statusRank(project.status)) return

  await putDoc<Project>('projects', { ...project, status: earliest, updatedAt: nowIso() })
}

// Records saved before the statuses were unified used past-tense names, and
// projects called capturing "imaging".
const LEGACY_STATUS: Record<string, Status> = {
  captured: 'capturing',
  transferred: 'transferring',
  imaging: 'capturing',
}

// One-time rewrite of old status values, run per account the first time the
// app loads after the change. Marked done only after every collection has been
// rewritten, so a failure (offline, mid-way) simply retries on the next launch.
export async function migrateLegacyStatuses(uid: string): Promise<void> {
  const flag = `status-migration-v1:${uid}`
  try {
    if (localStorage.getItem(flag)) return
  } catch {
    // storage unavailable: just run it, it's idempotent
  }

  for (const name of ['projects', 'sessions', 'frames'] as const) {
    const docs = await getAllFromServer<{ id: string; status: string }>(name)
    const stale = docs.filter((d) => d.status in LEGACY_STATUS)
    await bulkMerge(
      name,
      stale.map((d) => ({ id: d.id, status: LEGACY_STATUS[d.status] })),
    )
  }

  try {
    localStorage.setItem(flag, '1')
  } catch {
    // ignore
  }
}
