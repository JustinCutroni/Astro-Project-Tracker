import { describe, expect, it, vi } from 'vitest'
import { buildPlan, clampNights, nightDates, planNotes, splitSubs } from './planBuild'
import { integrationMinutesForFrames } from '../types/models'
import type { GearCatalog } from './gear'
import type { ProjectPlan } from './planParse'

// gear.ts also holds database hooks; stub them so these tests never start Firebase.
vi.mock('../firebase/firestoreDb', () => ({}))

const added = '2020-01-01'
const catalog: GearCatalog = {
  cameras: [{ id: 'cam', description: 'ASI2600MM Pro', dateAdded: added }],
  telescopes: [{ id: 'scope', description: 'Redcat 51', dateAdded: added }],
  mounts: [{ id: 'mount', description: 'AM5', dateAdded: added }],
  filters: [
    { id: 'f-l', description: 'L', dateAdded: added },
    { id: 'f-ha', description: 'Ha', dateAdded: added },
  ],
}

const plan: ProjectPlan = {
  target: 'M31 - Andromeda Galaxy',
  goalHours: '25',
  source: 'https://www.astrobin.com/abc123/',
  equipment: { camera: 'ASI2600MM Pro', telescope: 'Redcat 51', mount: 'Unknown mount' },
  filters: [
    { filter: 'Lum/Clear', subs: 159, exposureSeconds: 300 },
    { filter: 'Hα', subs: 101, exposureSeconds: 300 },
  ],
}

const input = {
  plan,
  filterIds: ['f-l', 'f-ha'],
  dates: ['2026-11-01', '2026-11-02'],
  location: '',
  gear: { cameraId: 'cam', telescopeId: 'scope', mountId: 'mount' },
  catalog,
  now: '2026-10-17T12:00:00.000Z',
}

describe('splitSubs', () => {
  it('splits as evenly as whole subs allow, earliest nights getting the extra', () => {
    expect(splitSubs(159, 5)).toEqual([32, 32, 32, 32, 31])
    expect(splitSubs(10, 3)).toEqual([4, 3, 3])
  })

  it('never loses or invents a sub', () => {
    for (const [subs, nights] of [[1, 1], [7, 7], [305, 12], [100, 30]]) {
      expect(splitSubs(subs, nights).reduce((a, b) => a + b, 0)).toBe(subs)
    }
  })
})

describe('clampNights', () => {
  it('keeps a sensible request', () => {
    expect(clampNights(4, [159, 101])).toBe(4)
  })

  it('stays between 1 and the limits', () => {
    expect(clampNights(0, [10])).toBe(1)
    expect(clampNights(-3, [10])).toBe(1)
    expect(clampNights(NaN, [10])).toBe(1)
    expect(clampNights(2.9, [10])).toBe(2)
    expect(clampNights(500, [1000])).toBe(30)
  })

  it('never makes more nights than the biggest filter has subs', () => {
    expect(clampNights(10, [3, 2])).toBe(3)
    expect(clampNights(10, [])).toBe(1)
  })
})

describe('nightDates', () => {
  it('starts on the start date and runs on day by day', () => {
    expect(nightDates([], 3, '2026-11-29')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01'])
  })

  it('crosses month and year ends', () => {
    expect(nightDates([], 2, '2026-12-31')).toEqual(['2026-12-31', '2027-01-01'])
  })

  it('keeps dates already chosen, including a cleared one', () => {
    expect(nightDates(['2026-11-05', ''], 4, '2026-11-01')).toEqual(['2026-11-05', '', '2026-11-01', '2026-11-02'])
  })

  it('drops dates beyond the new number of nights', () => {
    expect(nightDates(['2026-11-05', '2026-11-09'], 1, '2026-11-01')).toEqual(['2026-11-05'])
  })
})

describe('planNotes', () => {
  it('records the source, all equipment names, and the acquisition table', () => {
    expect(planNotes(plan)).toBe(
      [
        'Imported plan',
        'Source: https://www.astrobin.com/abc123/',
        'Equipment: ASI2600MM Pro · Redcat 51 · Unknown mount',
        'Acquisition:',
        'Lum/Clear: 159 × 300s (13h 15m)',
        'Hα: 101 × 300s (8h 25m)',
        'Total: 260 subs (21h 40m)',
      ].join('\n'),
    )
  })

  it('leaves out what the plan did not say', () => {
    const notes = planNotes({ target: 'M42', equipment: {}, filters: [{ filter: 'L', subs: 1, exposureSeconds: 60 }] })
    expect(notes).not.toMatch(/Source|Equipment/)
  })
})

describe('buildPlan', () => {
  it('creates a planning project that carries the plan details in its notes', () => {
    const { project } = buildPlan(input)
    expect(project).toMatchObject({ target: 'M31 - Andromeda Galaxy', goalHours: '25', status: 'planning' })
    expect(project.notes).toBe(planNotes(plan))
  })

  it('creates one dated planning session per night, linked to the project', () => {
    const { project, sessions } = buildPlan({ ...input, location: ' Backyard ' })
    expect(sessions.map((s) => s.date)).toEqual(['2026-11-01', '2026-11-02'])
    expect(sessions.every((s) => s.projectId === project.id && s.status === 'planning')).toBe(true)
    expect(sessions[0].location).toBe('Backyard')
  })

  it('leaves location unset when blank', () => {
    expect(buildPlan(input).sessions[0].location).toBeUndefined()
  })

  it("attaches the chosen equipment and that night's filters to each session", () => {
    const { sessions } = buildPlan(input)
    const gear = sessions[0].gear
    expect(gear?.camera?.id).toBe('cam')
    expect(gear?.telescope?.id).toBe('scope')
    expect(gear?.mount?.id).toBe('mount')
    expect(gear?.filters?.map((f) => f.id)).toEqual(['f-l', 'f-ha'])
  })

  it('leaves out equipment that was not chosen', () => {
    const { sessions } = buildPlan({ ...input, gear: { cameraId: '', telescopeId: '', mountId: '' } })
    expect(sessions[0].gear).toEqual({ filters: expect.any(Array) })
  })

  it('splits light frames across nights without losing any', () => {
    const { frames } = buildPlan(input)
    const lights = frames.filter((f) => f.frameType === 'light')
    const total = (filterId: string) => lights.filter((f) => f.filterId === filterId).reduce((n, f) => n + f.count, 0)
    expect(total('f-l')).toBe(159)
    expect(total('f-ha')).toBe(101)
    expect(lights.every((f) => f.exposureSeconds === 300 && f.status === 'planning')).toBe(true)
  })

  it('gives each session a flat and a matching flat-dark per filter it uses', () => {
    const { sessions, frames } = buildPlan(input)
    for (const session of sessions) {
      const mine = frames.filter((f) => f.sessionId === session.id)
      for (const filterId of ['f-l', 'f-ha']) {
        const flat = mine.find((f) => f.frameType === 'flat' && f.filterId === filterId)
        const flatDark = mine.find((f) => f.frameType === 'flat-dark' && f.filterId === filterId)
        expect(flat).toMatchObject({ count: 20, exposureSeconds: 0, status: 'planning' })
        expect(flatDark).toMatchObject({ count: 20, exposureSeconds: flat?.exposureSeconds })
      }
      expect(mine).toHaveLength(2 + 2 * 2)
    }
  })

  it('links every frame to its project and session, with a name for its filter', () => {
    const { project, sessions, frames } = buildPlan(input)
    expect(frames.every((f) => f.projectId === project.id && sessions.some((s) => s.id === f.sessionId))).toBe(true)
    expect(frames.find((f) => f.filterId === 'f-ha')?.filterName).toBe('Ha')
  })

  it('skips a filter the user chose to skip, along with its flats', () => {
    const { sessions, frames } = buildPlan({ ...input, filterIds: ['f-l', ''] })
    expect(frames.some((f) => f.filterId === 'f-ha')).toBe(false)
    expect(sessions[0].gear?.filters?.map((f) => f.id)).toEqual(['f-l'])
  })

  it('makes one flat per filter even when a filter appears twice', () => {
    const twice: ProjectPlan = {
      ...plan,
      filters: [
        { filter: 'L', subs: 10, exposureSeconds: 300 },
        { filter: 'L', subs: 10, exposureSeconds: 180 },
      ],
    }
    const { frames } = buildPlan({ ...input, plan: twice, filterIds: ['f-l', 'f-l'], dates: ['2026-11-01'] })
    expect(frames.filter((f) => f.frameType === 'light')).toHaveLength(2)
    expect(frames.filter((f) => f.frameType === 'flat')).toHaveLength(1)
  })

  it('counts no integration time until the planned batches are captured', () => {
    expect(integrationMinutesForFrames(buildPlan(input).frames)).toBe(0)
  })

  it('gives every record a unique id', () => {
    const { project, sessions, frames } = buildPlan(input)
    const ids = [project.id, ...sessions.map((s) => s.id), ...frames.map((f) => f.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })
})
