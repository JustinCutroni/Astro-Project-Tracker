import { useCollection } from '../firebase/firestoreDb'
import type {
  Camera,
  CameraSnapshot,
  FilterDef,
  Frame,
  Mount,
  MountSnapshot,
  Project,
  Retirable,
  Session,
  SessionGear,
  Telescope,
  TelescopeSnapshot,
} from '../types/models'

// Gear (cameras, telescopes, mounts, filters) is reference data that history
// points at, so it is retired rather than deleted once anything uses it, and
// each session keeps its own point-in-time copy of what was used that night.

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
  }
}

export function snapshotTelescope(t: Telescope): TelescopeSnapshot {
  return { id: t.id, description: t.description, focalLength: t.focalLength }
}

export function snapshotMount(m: Mount): MountSnapshot {
  return { id: m.id, description: m.description }
}

// Form state for a session's gear pickers: '' means "not set".
export interface GearIds {
  cameraId: string
  telescopeId: string
  mountId: string
}

export function idsFromGear(gear: SessionGear | undefined): GearIds {
  return {
    cameraId: gear?.camera?.id ?? '',
    telescopeId: gear?.telescope?.id ?? '',
    mountId: gear?.mount?.id ?? '',
  }
}

// Builds the snapshot to store on a session. A slot whose selection is
// unchanged keeps its existing snapshot rather than being refreshed from the
// catalog - that is the whole point: later edits to the catalog entry must
// not rewrite what was recorded for that night.
export function buildSessionGear(
  ids: GearIds,
  cameras: Camera[],
  telescopes: Telescope[],
  mounts: Mount[],
  previous?: SessionGear,
): SessionGear {
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
  return gear
}

// The first candidate id that points at gear still in service, else ''. Used
// to pre-fill a new session from the previous session / the project without
// defaulting to something that has since been sold.
export function firstActiveId(items: Retirable[], ...candidates: (string | undefined)[]): string {
  for (const id of candidates) {
    if (id && items.some((item) => item.id === id && !item.retiredAt)) return id
  }
  return ''
}

export function defaultGearIds(
  cameras: Camera[],
  telescopes: Telescope[],
  mounts: Mount[],
  ...sources: (Pick<Project, 'cameraId' | 'telescopeId' | 'mountId'> | GearIds | undefined)[]
): GearIds {
  const pick = (key: 'cameraId' | 'telescopeId' | 'mountId', items: Retirable[]) =>
    firstActiveId(items, ...sources.map((s) => s?.[key]))
  return {
    cameraId: pick('cameraId', cameras),
    telescopeId: pick('telescopeId', telescopes),
    mountId: pick('mountId', mounts),
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
}

// All three gear collections, or undefined until every one has loaded.
export function useGearCatalog(): GearCatalog | undefined {
  const cameras = useCollection<Camera>('cameras')
  const telescopes = useCollection<Telescope>('telescopes')
  const mounts = useCollection<Mount>('mounts')
  if (!cameras || !telescopes || !mounts) return undefined
  return { cameras, telescopes, mounts }
}

// How many records point at each piece of gear (by id), so Settings can tell
// what is safe to delete outright and what must be retired instead.
export function useGearUsage(): Map<string, number> | undefined {
  const projects = useCollection<Project>('projects')
  const sessions = useCollection<Session>('sessions')
  const frames = useCollection<Frame>('frames')
  if (!projects || !sessions || !frames) return undefined

  const usage = new Map<string, number>()
  const bump = (id: string | undefined) => {
    if (id) usage.set(id, (usage.get(id) ?? 0) + 1)
  }
  for (const p of projects) {
    bump(p.cameraId)
    bump(p.telescopeId)
    bump(p.mountId)
    p.filterIds.forEach(bump)
  }
  for (const s of sessions) {
    bump(s.gear?.camera?.id)
    bump(s.gear?.telescope?.id)
    bump(s.gear?.mount?.id)
  }
  for (const f of frames) bump(f.filterId)
  return usage
}
