import Dexie, { type EntityTable } from 'dexie'
import type {
  Camera,
  Mount,
  FilterDef,
  Frame,
  Project,
  Session,
  Telescope,
} from '../types/models'

export class AstroDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  sessions!: EntityTable<Session, 'id'>
  frames!: EntityTable<Frame, 'id'>
  cameras!: EntityTable<Camera, 'id'>
  telescopes!: EntityTable<Telescope, 'id'>
  mounts!: EntityTable<Mount, 'id'>
  filters!: EntityTable<FilterDef, 'id'>

  constructor() {
    super('astro-project-tracker')
    this.version(1).stores({
      projects: 'id, status, target, updatedAt',
      sessions: 'id, projectId, date, status',
      frames: 'id, sessionId, projectId, filterId, frameType, status',
      cameras: 'id, description',
      telescopes: 'id, description',
      mounts: 'id, description',
      filters: 'id, description',
    })
  }
}

export const db = new AstroDB()

export function newId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

// Seed the filter list used by the source AppSheet app so the frame form
// isn't empty. Safe to call every startup - only inserts when empty.
//
// The check-then-insert is wrapped in a single readwrite transaction so two
// overlapping calls (e.g. React StrictMode double-invoking effects in dev)
// can't both see an empty table and double-seed it - IndexedDB serializes
// readwrite transactions against the same store.
export async function seedDefaultsIfEmpty(): Promise<void> {
  await db.transaction('rw', db.filters, async () => {
    const filterCount = await db.filters.count()
    if (filterCount === 0) {
      const defaults = ['L', 'R', 'G', 'B', 'S', 'Ha', 'OIII', 'L-Enhance', 'L-Extreme', 'Dark', 'None']
      await db.filters.bulkAdd(
        defaults.map((description) => ({ id: newId(), description, dateAdded: nowIso() })),
      )
    }
  })
}
