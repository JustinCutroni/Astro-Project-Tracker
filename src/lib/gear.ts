import { useCollection } from '../firebase/firestoreDb'
import { sortFilters } from './filters'
import type {
  Camera,
  CameraSnapshot,
  FilterDef,
  FilterSnapshot,
  Frame,
  Mount,
  MountSnapshot,
  Retirable,
  Session,
  SessionGear,
  Telescope,
  TelescopeSnapshot,
} from '../types/models'

// Gear (cameras, telescopes, mounts, filters) is reference data that history
// points at, so it is retired rather than deleted once anything uses it. Gear
// belongs to sessions: each session keeps its own point-in-time copy of what
// was used that night, and its frame batches draw from it.

export function isRetired(item: Retirable | undefined): boolean {
  return Boolean(item?.retiredAt)
}

// Items to offer in a picker: everything still in service, plus any retired
// item the record being edited already uses - dropping that would silently
// blank the field on save.
export function selectable<T extends Retirable>(items: T[], keepIds: (string | undefined)[] = []): T[] {
  return items.filter((item) => !item.retiredAt || keepIds.includes(item.id))
}

export function optionLabel(item: { description: string; retiredAt?: string }): string {
  return item.retiredAt ? `${item.description} (retired)` : item.description
}

export function snapshotCamera(c: Camera): CameraSnapshot {
  return {
    id: c.id,
    description: c.description,
    cameraType: c.cameraType,
    sensorWidthMm: c.sensorWidthMm,
    sensorHeightMm: c.sensorHeightMm,
    pixelSizeUm: c.pixelSizeUm,
    resolutionWidthPx: c.resolutionWidthPx,
    resolutionHeightPx: c.resolutionHeightPx,
    sensorType: c.sensorType,
    defaultGain: c.defaultGain,
  }
}

export function snapshotTelescope(t: Telescope): TelescopeSnapshot {
  return { id: t.id, description: t.description, focalLength: t.focalLength }
}

export function snapshotMount(m: Mount): MountSnapshot {
  return { id: m.id, description: m.description }
}

export function snapshotFilter(f: FilterDef): FilterSnapshot {
  return { id: f.id, description: f.description, position: f.position }
}

// Form state for a session's gear pickers: '' means "not set".
export interface GearIds {
  cameraId: string
  telescopeId: string
  mountId: string
  filterIds: string[]
}

export function idsFromGear(gear: SessionGear | undefined): GearIds {
  return {
    cameraId: gear?.camera?.id ?? '',
    telescopeId: gear?.telescope?.id ?? '',
    mountId: gear?.mount?.id ?? '',
    filterIds: gear?.filters?.map((f) => f.id) ?? [],
  }
}

// Builds the snapshot to store on a session. A slot whose selection is
// unchanged keeps its existing snapshot rather than being refreshed from the
// catalog - that is the whole point: later edits to the catalog entry must
// not rewrite what was recorded for that night.
export function buildSessionGear(ids: GearIds, catalog: GearCatalog, previous?: SessionGear): SessionGear {
  const { cameras, telescopes, mounts, filters } = catalog
  const gear: SessionGear = {}

  if (ids.cameraId) {
    if (previous?.camera?.id === ids.cameraId) gear.camera = previous.camera
    else {
      const live = cameras.find((c) => c.id === ids.cameraId)
      if (live) gear.camera = snapshotCamera(live)
    }
  }
  if (ids.telescopeId) {
    if (previous?.telescope?.id === ids.telescopeId) gear.telescope = previous.telescope
    else {
      const live = telescopes.find((t) => t.id === ids.telescopeId)
      if (live) gear.telescope = snapshotTelescope(live)
    }
  }
  if (ids.mountId) {
    if (previous?.mount?.id === ids.mountId) gear.mount = previous.mount
    else {
      const live = mounts.find((m) => m.id === ids.mountId)
      if (live) gear.mount = snapshotMount(live)
    }
  }
  const filterSnapshots = ids.filterIds.flatMap((id) => {
    const kept = previous?.filters?.find((f) => f.id === id)
    if (kept) return [kept]
    const live = filters.find((f) => f.id === id)
    return live ? [snapshotFilter(live)] : []
  })
  if (filterSnapshots.length > 0) gear.filters = filterSnapshots
  return gear
}

// A session's filters are only open to change while it is still planned;
// once it has been captured they record what was actually in the light path.
export function filtersEditable(status: Session['status']): boolean {
  return status === 'planning'
}

// --- Re-pointing frame batches when a planned session's filters change ---
//
// Removing a filter from a planned session (say S -> H) means its batches
// that used it have to go somewhere. `replacements` maps each removed filter
// id to the filter id to move those batches to, or '' to clear the filter.

// Filters dropped from the set that frame batches still use, in their original order.
export function removedFiltersInUse(
  originalIds: string[],
  newIds: string[],
  usedIds: (string | undefined)[],
): string[] {
  return originalIds.filter((id) => !newIds.includes(id) && usedIds.includes(id))
}

// Pairs each dropped filter with a newly added one in order (S dropped, H
// added: S -> H), so the common swap needs no extra clicks. Anything left
// over defaults to clearing the filter.
export function defaultReplacements(
  originalIds: string[],
  newIds: string[],
  removed: string[],
): Record<string, string> {
  const added = newIds.filter((id) => !originalIds.includes(id))
  return Object.fromEntries(removed.map((id, i) => [id, added[i] ?? '']))
}

// The replacements to apply: the automatic pairing, overridden by anything the
// user picked explicitly.
export function effectiveReplacements(
  originalIds: string[],
  newIds: string[],
  usedIds: (string | undefined)[],
  overrides: Record<string, string>,
): Record<string, string> {
  const removed = removedFiltersInUse(originalIds, newIds, usedIds)
  return { ...defaultReplacements(originalIds, newIds, removed), ...overrides }
}

// Where a batch with this filter ends up after the change.
export function remapFilterId(
  filterId: string | undefined,
  newIds: string[],
  replacements: Record<string, string>,
): string | undefined {
  if (!filterId || newIds.includes(filterId)) return filterId
  return replacements[filterId] || undefined
}

// The filters a frame batch may use in this session, in wheel order, plus
// whichever one the batch already has (so editing it never blanks the field).
export function sessionFilterOptions(
  session: Session | undefined,
  keep?: { id: string; description: string },
): FilterSnapshot[] {
  const own = session?.gear?.filters ?? []
  return sortFilters(keep && !own.some((f) => f.id === keep.id) ? [...own, keep] : own)
}

// The first candidate id that points at gear still in service, else ''. Used
// to pre-fill a new session from the previous one without defaulting to
// something that has since been sold.
export function firstActiveId(items: Retirable[], ...candidates: (string | undefined)[]): string {
  for (const id of candidates) {
    if (id && items.some((item) => item.id === id && !item.retiredAt)) return id
  }
  return ''
}

// Pre-fills a new session from the most recent session's gear (what you
// imaged with last time is the best guess for tonight), skipping anything
// retired since.
export function defaultGearIds(catalog: GearCatalog, ...sources: (GearIds | undefined)[]): GearIds {
  const pick = (key: 'cameraId' | 'telescopeId' | 'mountId', items: Retirable[]) =>
    firstActiveId(items, ...sources.map((s) => s?.[key]))
  const source = sources.find((s) => s && s.filterIds.length > 0)
  return {
    cameraId: pick('cameraId', catalog.cameras),
    telescopeId: pick('telescopeId', catalog.telescopes),
    mountId: pick('mountId', catalog.mounts),
    filterIds: (source?.filterIds ?? []).filter((id) => catalog.filters.some((f) => f.id === id && !f.retiredAt)),
  }
}

// What to call a frame batch's filter: the name it had when it was logged,
// then the current catalog name, then a placeholder - never nothing.
export function frameFilterName(frame: Pick<Frame, 'filterId' | 'filterName'>, filters: FilterDef[]): string | undefined {
  if (!frame.filterId) return undefined
  return frame.filterName ?? filters.find((f) => f.id === frame.filterId)?.description ?? 'Unknown filter'
}

export interface GearCatalog {
  cameras: Camera[]
  telescopes: Telescope[]
  mounts: Mount[]
  filters: FilterDef[]
}

// All four gear collections, or undefined until every one has loaded.
export function useGearCatalog(): GearCatalog | undefined {
  const cameras = useCollection<Camera>('cameras')
  const telescopes = useCollection<Telescope>('telescopes')
  const mounts = useCollection<Mount>('mounts')
  const filters = useCollection<FilterDef>('filters')
  if (!cameras || !telescopes || !mounts || !filters) return undefined
  return { cameras, telescopes, mounts, filters }
}

// How many records point at each piece of gear (by id), so Settings can tell
// what is safe to delete outright and what must be retired instead.
export function useGearUsage(): Map<string, number> | undefined {
  const sessions = useCollection<Session>('sessions')
  const frames = useCollection<Frame>('frames')
  if (!sessions || !frames) return undefined

  const usage = new Map<string, number>()
  const bump = (id: string | undefined) => {
    if (id) usage.set(id, (usage.get(id) ?? 0) + 1)
  }
  for (const s of sessions) {
    bump(s.gear?.camera?.id)
    bump(s.gear?.telescope?.id)
    bump(s.gear?.mount?.id)
    s.gear?.filters?.forEach((f) => bump(f.id))
  }
  for (const f of frames) bump(f.filterId)
  return usage
}
