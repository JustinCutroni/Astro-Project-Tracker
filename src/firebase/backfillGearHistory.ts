import { bulkMerge, getAllFromServer } from './firestoreDb'
import { buildSessionGear } from '../lib/gear'
import type { Camera, FilterDef, Frame, Mount, Project, Session, Telescope } from '../types/models'

// One-time, idempotent backfill for data logged before sessions kept their
// own gear: stamps each such session with a snapshot of its project's current
// camera/telescope/mount, and each frame batch with its filter's name, so that
// retiring or editing gear afterwards can't change what those records say.
// It is the best available reconstruction - the project's gear is the only
// record of what an old session used. Already-deleted gear can't be recovered.
//
// It merges individual fields rather than rewriting documents, so it can't
// clobber a concurrent edit from another device. Because it reads every
// document, a successful run is remembered per user on this device and not
// repeated.
export async function backfillGearHistory(uid: string): Promise<void> {
  const doneKey = `gearHistoryBackfilled:${uid}`
  try {
    if (localStorage.getItem(doneKey)) return
  } catch {
    // Storage blocked: fall through and just run it (it is idempotent).
  }

  try {
    const [projects, sessions, frames, cameras, telescopes, mounts, filters] = await Promise.all([
      getAllFromServer<Project>('projects'),
      getAllFromServer<Session>('sessions'),
      getAllFromServer<Frame>('frames'),
      getAllFromServer<Camera>('cameras'),
      getAllFromServer<Telescope>('telescopes'),
      getAllFromServer<Mount>('mounts'),
      getAllFromServer<FilterDef>('filters'),
    ])

    const sessionUpdates = sessions
      .filter((s) => s.gear === undefined)
      .flatMap((s) => {
        const project = projects.find((p) => p.id === s.projectId)
        if (!project) return []
        const gear = buildSessionGear(
          {
            cameraId: project.cameraId ?? '',
            telescopeId: project.telescopeId ?? '',
            mountId: project.mountId ?? '',
          },
          cameras,
          telescopes,
          mounts,
        )
        return [{ id: s.id, gear }]
      })

    const frameUpdates = frames
      .filter((f) => f.filterId && !f.filterName)
      .flatMap((f) => {
        const filter = filters.find((x) => x.id === f.filterId)
        return filter ? [{ id: f.id, filterName: filter.description }] : []
      })

    await bulkMerge('sessions', sessionUpdates)
    await bulkMerge('frames', frameUpdates)
    try {
      localStorage.setItem(doneKey, '1')
    } catch {
      // Not remembered; it will run again next launch, harmlessly.
    }
  } catch (err) {
    // Offline or a transient failure: nothing was written, so the next launch
    // simply tries again.
    console.error('backfillGearHistory failed:', err)
  }
}
