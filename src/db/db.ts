import Dexie, { type EntityTable } from 'dexie'
import type {
  DataBatch,
  Equipment,
  FilterDef,
  Location,
  Project,
  Session,
} from '../types/models'

export class AstroDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  sessions!: EntityTable<Session, 'id'>
  equipment!: EntityTable<Equipment, 'id'>
  filters!: EntityTable<FilterDef, 'id'>
  locations!: EntityTable<Location, 'id'>
  dataBatches!: EntityTable<DataBatch, 'id'>

  constructor() {
    super('astro-project-tracker')
    this.version(1).stores({
      projects: 'id, status, target, updatedAt',
      sessions: 'id, projectId, date, locationId',
      equipment: 'id, type, name',
      filters: 'id, name',
      locations: 'id, name',
      dataBatches: 'id, projectId, sessionId, stage',
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

// Seed a handful of common filters/equipment types on first run so the
// session form isn't empty. Safe to call every startup - it only inserts
// when the tables are empty.
export async function seedDefaultsIfEmpty(): Promise<void> {
  const filterCount = await db.filters.count()
  if (filterCount === 0) {
    const defaults: Omit<FilterDef, 'id'>[] = [
      { name: 'Luminance' },
      { name: 'Red' },
      { name: 'Green' },
      { name: 'Blue' },
      { name: 'Ha', bandwidthNm: 7 },
      { name: 'OIII', bandwidthNm: 7 },
      { name: 'SII', bandwidthNm: 7 },
    ]
    await db.filters.bulkAdd(defaults.map((f) => ({ ...f, id: newId() })))
  }
}
