import { flatDarkFor } from './flatDarks'
import { formatDeclination, formatMinutes, formatRightAscension } from './format'
import { buildSessionGear, type GearCatalog } from './gear'
import { newId } from './ids'
import type { PlanFilterRow, ProjectPlan } from './planParse'
import type { Frame, Project, Session } from '../types/models'

export const MAX_NIGHTS = 60
export const DEFAULT_HOURS_PER_NIGHT = 8
const MIN_HOURS_PER_NIGHT = 1
const MAX_HOURS_PER_NIGHT = 24
const FLAT_COUNT = 20 // the app's usual flat count (see FrameForm)

// A plan is only an idea, so everything it creates starts in Planning.

// What the user typed for "hours per night", made safe: anything unusable
// falls back to the default rather than producing nonsense nights.
export function hoursPerNightFrom(text: string): number {
  const hours = Number(text)
  if (!text.trim() || !Number.isFinite(hours) || hours < MIN_HOURS_PER_NIGHT) return DEFAULT_HOURS_PER_NIGHT
  return Math.min(hours, MAX_HOURS_PER_NIGHT)
}

// One night's share of a filter's subs: as even as whole subs allow, with the
// leftover going to the earliest nights (159 over 5 nights: 32, 32, 32, 32, 31).
export function splitSubs(subs: number, nights: number): number[] {
  const base = Math.floor(subs / nights)
  const extra = subs % nights
  return Array.from({ length: nights }, (_, night) => base + (night < extra ? 1 : 0))
}

// One plan row's subs on one night.
export interface NightShare {
  rowIndex: number // which row of plan.filters
  subs: number
}

export interface Night {
  shares: NightShare[]
}

interface FilterGroup {
  rowIndexes: number[] // a filter can have several rows, one per exposure length
  seconds: number
}

// Which filters are shot on which night. Normally a night holds one filter; a
// filter with more hours than fit in one night is spread over as many nights
// as it needs, its subs split evenly. With `combineShort`, filters that fit in
// a night on their own may share one, packed in plan order until it is full.
// Rows whose filterId is '' (skipped) get no nights.
export function planNights(
  rows: PlanFilterRow[],
  filterIds: string[],
  hoursPerNight: number,
  combineShort: boolean,
): Night[] {
  const groups = new Map<string, FilterGroup>()
  rows.forEach((row, rowIndex) => {
    const filterId = filterIds[rowIndex]
    if (!filterId) return
    const group = groups.get(filterId) ?? { rowIndexes: [], seconds: 0 }
    group.rowIndexes.push(rowIndex)
    group.seconds += row.subs * row.exposureSeconds
    groups.set(filterId, group)
  })

  const nightSeconds = hoursPerNight * 3600
  const nights: Night[] = []
  let open: { night: Night; seconds: number } | undefined

  for (const group of groups.values()) {
    const mostSubs = Math.max(...group.rowIndexes.map((i) => rows[i].subs))
    // Never more nights than the biggest row has subs, so no night is empty.
    const count = Math.min(Math.ceil(group.seconds / nightSeconds), mostSubs)

    if (count === 1 && combineShort) {
      const shares = group.rowIndexes.map((rowIndex) => ({ rowIndex, subs: rows[rowIndex].subs }))
      if (open && open.seconds + group.seconds <= nightSeconds) {
        open.night.shares.push(...shares)
        open.seconds += group.seconds
      } else {
        const night = { shares }
        nights.push(night)
        open = { night, seconds: group.seconds }
      }
      continue
    }

    open = undefined
    const split = group.rowIndexes.map((rowIndex) => splitSubs(rows[rowIndex].subs, count))
    for (let night = 0; night < count; night++) {
      const shares = group.rowIndexes
        .map((rowIndex, i) => ({ rowIndex, subs: split[i][night] }))
        .filter((share) => share.subs > 0)
      nights.push({ shares })
    }
  }
  return nights
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

// Dates for each night: keeps what is already entered, and starts any new
// night the day after the one before it (or on `start` for the first).
export function nightDates(existing: string[], nights: number, start: string): string[] {
  const dates: string[] = []
  for (let i = 0; i < nights; i++) {
    const previous = dates[i - 1]
    dates.push(existing[i] ?? (previous ? addDays(previous, 1) : start))
  }
  return dates
}

const isFromAstroBin = (plan: ProjectPlan) => /(^|\/\/|\.)astrobin\.com(\/|$)/i.test(plan.source ?? '')

// Everything a plan said, kept in the project notes: the title as given, where
// it came from, and the equipment names (equipment is only recorded here, never
// matched to the gear catalog).
export function planNotes(plan: ProjectPlan): string {
  const fromAstroBin = isFromAstroBin(plan)
  const lines = [fromAstroBin ? 'Imported from AstroBin' : 'Imported plan']
  lines.push(`Title: ${plan.target}`)
  if (plan.source) lines.push(`Source: ${plan.source}`)
  const gear = [plan.equipment.camera, plan.equipment.telescope, plan.equipment.mount].filter(Boolean)
  if (gear.length > 0) lines.push(`${fromAstroBin ? 'Equipment (from AstroBin)' : 'Equipment'}: ${gear.join(' · ')}`)
  if (plan.coordinates) {
    lines.push(
      `Centre: ${formatRightAscension(plan.coordinates.raHours)} · ${formatDeclination(plan.coordinates.decDegrees)}`,
    )
  }
  if (plan.fieldDegrees) lines.push(`Field of view: ${plan.fieldDegrees.width}° × ${plan.fieldDegrees.height}°`)
  lines.push('Acquisition:')
  for (const row of plan.filters) {
    const minutes = (row.subs * row.exposureSeconds) / 60
    lines.push(`${row.filter}: ${row.subs} × ${row.exposureSeconds}s (${formatMinutes(minutes)})`)
  }
  const totalSubs = plan.filters.reduce((sum, row) => sum + row.subs, 0)
  const totalMinutes = plan.filters.reduce((sum, row) => sum + (row.subs * row.exposureSeconds) / 60, 0)
  lines.push(`Total: ${totalSubs} subs (${formatMinutes(totalMinutes)})`)
  return lines.join('\n')
}

export interface BuildInput {
  plan: ProjectPlan
  target: string // what the user settled on in the preview
  projectName: string // blank means "use the target"
  // One catalog filter id per plan filter row, in the same order.
  filterIds: string[]
  nights: Night[] // from planNights
  dates: string[] // one per night, in the same order
  location: string
  catalog: GearCatalog
  now: string
}

export interface BuiltPlan {
  project: Project
  sessions: Session[]
  frames: Frame[]
}

export function buildPlan({ plan, target, projectName, filterIds, nights, dates, location, catalog, now }: BuildInput): BuiltPlan {
  const project: Project = {
    id: newId(),
    target: target.trim(),
    projectName: projectName.trim() || undefined,
    status: 'planning',
    goalHours: plan.goalHours,
    notes: planNotes(plan),
    createdAt: now,
    updatedAt: now,
  }

  const sessions: Session[] = []
  const frames: Frame[] = []

  nights.forEach((night, nightIndex) => {
    const sessionId = newId()
    const sessionFilterIds: string[] = []
    const batch = (filterId: string, frameType: Frame['frameType'], count: number, exposureSeconds: number): Frame => ({
      id: newId(),
      sessionId,
      projectId: project.id,
      frameType,
      filterId,
      filterName: catalog.filters.find((f) => f.id === filterId)?.description,
      count,
      exposureSeconds,
      status: 'planning',
      createdAt: now,
      updatedAt: now,
    })

    for (const share of night.shares) {
      const filterId = filterIds[share.rowIndex]
      if (!sessionFilterIds.includes(filterId)) sessionFilterIds.push(filterId)
      frames.push(batch(filterId, 'light', share.subs, plan.filters[share.rowIndex].exposureSeconds))
    }

    // Flats are shot per filter, and their exposure isn't known until captured.
    for (const filterId of sessionFilterIds) {
      const flat = batch(filterId, 'flat', FLAT_COUNT, 0)
      frames.push(flat, flatDarkFor(flat))
    }

    sessions.push({
      id: sessionId,
      projectId: project.id,
      date: dates[nightIndex],
      location: location.trim() || undefined,
      status: 'planning',
      gear: buildSessionGear({ cameraId: '', telescopeId: '', mountId: '', filterIds: sessionFilterIds }, catalog),
      createdAt: now,
      updatedAt: now,
    })
  })

  return { project, sessions, frames }
}
