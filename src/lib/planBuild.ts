import { flatDarkFor } from './flatDarks'
import { formatMinutes } from './format'
import { buildSessionGear, type GearCatalog, type GearIds } from './gear'
import { newId } from './ids'
import type { ProjectPlan } from './planParse'
import type { Frame, Project, Session } from '../types/models'

export const MAX_NIGHTS = 30
const FLAT_COUNT = 20 // the app's usual flat count (see FrameForm)

// A plan is only an idea, so everything it creates starts in Planning.

// One night's share of a filter's subs: as even as whole subs allow, with the
// leftover going to the earliest nights (159 over 5 nights: 32, 32, 32, 32, 31).
export function splitSubs(subs: number, nights: number): number[] {
  const base = Math.floor(subs / nights)
  const extra = subs % nights
  return Array.from({ length: nights }, (_, night) => base + (night < extra ? 1 : 0))
}

// More nights than the biggest filter has subs would leave empty nights.
export function clampNights(requested: number, subsOfIncludedFilters: number[]): number {
  const most = Math.max(1, ...subsOfIncludedFilters)
  const wanted = Number.isFinite(requested) ? Math.floor(requested) : 1
  return Math.min(Math.max(wanted, 1), MAX_NIGHTS, most)
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

// Everything a plan said, kept in the project notes (including equipment names
// that matched nothing in the catalog).
export function planNotes(plan: ProjectPlan): string {
  const lines = ['Imported plan']
  if (plan.source) lines.push(`Source: ${plan.source}`)
  const gear = [plan.equipment.camera, plan.equipment.telescope, plan.equipment.mount].filter(Boolean)
  if (gear.length > 0) lines.push(`Equipment: ${gear.join(' · ')}`)
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
  // One catalog filter id per plan filter row, in the same order; '' skips that filter.
  filterIds: string[]
  dates: string[] // one per night; its length is the number of nights
  location: string
  gear: Pick<GearIds, 'cameraId' | 'telescopeId' | 'mountId'>
  catalog: GearCatalog
  now: string
}

export interface BuiltPlan {
  project: Project
  sessions: Session[]
  frames: Frame[]
}

export function buildPlan({ plan, filterIds, dates, location, gear, catalog, now }: BuildInput): BuiltPlan {
  const project: Project = {
    id: newId(),
    target: plan.target,
    status: 'planning',
    goalHours: plan.goalHours,
    notes: planNotes(plan),
    createdAt: now,
    updatedAt: now,
  }

  const nights = dates.length
  const subsPerNight = plan.filters.map((row) => splitSubs(row.subs, nights))
  const sessions: Session[] = []
  const frames: Frame[] = []

  dates.forEach((date, night) => {
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

    plan.filters.forEach((row, i) => {
      const filterId = filterIds[i]
      const count = subsPerNight[i][night]
      if (!filterId || count === 0) return
      if (!sessionFilterIds.includes(filterId)) sessionFilterIds.push(filterId)
      frames.push(batch(filterId, 'light', count, row.exposureSeconds))
    })

    // Flats are shot per filter, and their exposure isn't known until captured.
    for (const filterId of sessionFilterIds) {
      const flat = batch(filterId, 'flat', FLAT_COUNT, 0)
      frames.push(flat, flatDarkFor(flat))
    }

    sessions.push({
      id: sessionId,
      projectId: project.id,
      date,
      location: location.trim() || undefined,
      status: 'planning',
      gear: buildSessionGear({ ...gear, filterIds: sessionFilterIds }, catalog),
      createdAt: now,
      updatedAt: now,
    })
  })

  return { project, sessions, frames }
}
