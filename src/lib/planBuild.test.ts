import { describe, expect, it, vi } from 'vitest'
import { buildPlan, hoursPerNightFrom, nightDates, planNights, planNotes, splitSubs } from './planBuild'
import { integrationMinutesForFrames } from '../types/models'
import type { GearCatalog } from './gear'
import type { PlanFilterRow, ProjectPlan } from './planParse'

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

// L is 13h 15m and Ha 8h 25m, so at 8 hours a night each needs two nights.
const nights = planNights(plan.filters, ['f-l', 'f-ha'], 8, false)
const input = {
  plan,
  target: 'M31 - Andromeda Galaxy',
  projectName: 'M31 - A great night',
  filterIds: ['f-l', 'f-ha'],
  nights,
  dates: ['2026-11-01', '2026-11-05', '2026-11-09', '2026-11-13'],
  location: '',
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

describe('hoursPerNightFrom', () => {
  it('reads a sensible number', () => {
    expect(hoursPerNightFrom('8')).toBe(8)
    expect(hoursPerNightFrom('6.5')).toBe(6.5)
  })

  it('falls back to 8 hours for anything unusable', () => {
    for (const text of ['', '   ', 'lots', '0', '-3', '0.5', 'NaN', 'Infinity']) {
      expect(hoursPerNightFrom(text)).toBe(8)
    }
  })

  it('caps a night at 24 hours', () => {
    expect(hoursPerNightFrom('100')).toBe(24)
  })
})

describe('planNights', () => {
  const row = (filter: string, subs: number, exposureSeconds: number): PlanFilterRow => ({ filter, subs, exposureSeconds })
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `f${i}`)
  // What each night holds, as "row:subs" pairs, to keep the expectations readable.
  const layout = (list: ReturnType<typeof planNights>) =>
    list.map((n) => n.shares.map((s) => `${s.rowIndex}:${s.subs}`).join('+'))

  it('gives each filter its own night when it fits in one', () => {
    // L 3h50, R 1h50, G 1h30, B 1h50, Ha 4h15: all under 8 hours.
    const rows = [row('L', 23, 600), row('R', 11, 600), row('G', 9, 600), row('B', 11, 600), row('Ha', 17, 900)]
    expect(layout(planNights(rows, ids(5), 8, false))).toEqual(['0:23', '1:11', '2:9', '3:11', '4:17'])
  })

  it('spreads a filter that is too long for one night over as many nights as it needs', () => {
    // Four filters at 10 hours each (40 hours): two nights apiece.
    const rows = ['L', 'R', 'G', 'B'].map((f) => row(f, 200, 180))
    expect(layout(planNights(rows, ids(4), 8, false))).toEqual([
      '0:100', '0:100', '1:100', '1:100', '2:100', '2:100', '3:100', '3:100',
    ])
  })

  it('keeps a night to one filter however the hours fall', () => {
    const rows = [row('L', 159, 300), row('Ha', 101, 300)]
    const result = planNights(rows, ids(2), 8, false)
    expect(layout(result)).toEqual(['0:80', '0:79', '1:51', '1:50'])
    expect(result.every((n) => n.shares.length === 1)).toBe(true)
  })

  it('fits a filter that fills a night exactly, and needs another night for one sub more', () => {
    expect(planNights([row('L', 96, 300)], ids(1), 8, false)).toHaveLength(1) // exactly 8h
    expect(planNights([row('L', 97, 300)], ids(1), 8, false)).toHaveLength(2)
  })

  it('works with a night that is not a whole number of hours', () => {
    expect(planNights([row('L', 90, 300)], ids(1), 7.5, false)).toHaveLength(1) // exactly 7.5h
    expect(planNights([row('L', 91, 300)], ids(1), 7.5, false)).toHaveLength(2)
  })

  it('never makes more nights than the filter has subs', () => {
    // Two 10-hour subs would need 3 nights by time, but only 2 subs exist.
    expect(layout(planNights([row('L', 2, 36000)], ids(1), 8, false))).toEqual(['0:1', '0:1'])
  })

  it('shares nights between the exposure lengths of one filter', () => {
    // L at 300s and 180s: 5h + 5h = 10h, so two nights, each with both.
    const rows = [row('L', 60, 300), row('L', 100, 180)]
    expect(layout(planNights(rows, ['f-l', 'f-l'], 8, false))).toEqual(['0:30+1:50', '0:30+1:50'])
  })

  it('leaves a skipped filter out entirely', () => {
    const rows = [row('L', 10, 300), row('R', 10, 300), row('G', 10, 300)]
    expect(layout(planNights(rows, ['f-l', '', 'f-g'], 8, false))).toEqual(['0:10', '2:10'])
    expect(planNights(rows, ['', '', ''], 8, false)).toEqual([])
  })

  it('never loses or invents a sub', () => {
    const rows = [row('L', 159, 300), row('R', 15, 300), row('Ha', 101, 300), row('S', 58, 600)]
    for (const combine of [false, true]) {
      const totals = rows.map(() => 0)
      for (const night of planNights(rows, ids(4), 5, combine)) {
        for (const share of night.shares) totals[share.rowIndex] += share.subs
      }
      expect(totals).toEqual([159, 15, 101, 58])
    }
  })

  describe('when short filters may share a night', () => {
    it('packs filters that fit together, in plan order, until the night is full', () => {
      // L 3h50 + R 1h50 + G 1h30 = 7h10 fits in 8h; B 1h50 would make 9h, so it starts a new night.
      const rows = [row('L', 23, 600), row('R', 11, 600), row('G', 9, 600), row('B', 11, 600), row('Ha', 17, 900)]
      expect(layout(planNights(rows, ids(5), 8, true))).toEqual(['0:23+1:11+2:9', '3:11+4:17'])
    })

    it('never mixes in a filter that needs several nights, and starts packing afresh after it', () => {
      const rows = [row('S', 40, 180), row('L', 200, 180), row('R', 40, 180), row('G', 40, 180)]
      expect(layout(planNights(rows, ids(4), 8, true))).toEqual(['0:40', '1:100', '1:100', '2:40+3:40'])
    })

    it('gives the same nights as one-filter-per-night when nothing is short', () => {
      const rows = [row('L', 200, 180), row('R', 200, 180)]
      expect(layout(planNights(rows, ids(2), 8, true))).toEqual(layout(planNights(rows, ids(2), 8, false)))
    })
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
  it('records the title, source, equipment names and acquisition table, marked as from AstroBin', () => {
    expect(planNotes(plan)).toBe(
      [
        'Imported from AstroBin',
        'Title: M31 - Andromeda Galaxy',
        'Source: https://www.astrobin.com/abc123/',
        'Equipment (from AstroBin): ASI2600MM Pro · Redcat 51 · Unknown mount',
        'Acquisition:',
        'Lum/Clear: 159 × 300s (13h 15m)',
        'Hα: 101 × 300s (8h 25m)',
        'Total: 260 subs (21h 40m)',
      ].join('\n'),
    )
  })

  it('recognises AstroBin links in their different forms', () => {
    for (const source of ['https://app.astrobin.com/i/abc123', 'http://astrobin.com/abc123', 'https://AstroBin.com/x']) {
      expect(planNotes({ ...plan, source })).toMatch(/^Imported from AstroBin\n/)
    }
  })

  it('does not call a plan AstroBin just because the word appears', () => {
    for (const source of ['https://example.com/astrobin.com/1', 'https://notastrobin.com/1', undefined]) {
      const notes = planNotes({ ...plan, source })
      expect(notes).toMatch(/^Imported plan\n/)
      expect(notes).toContain('Equipment: ASI2600MM Pro')
      expect(notes).not.toContain('from AstroBin')
    }
  })

  it('writes the centre and field of view the way star charts do', () => {
    const notes = planNotes({
      ...plan,
      coordinates: { raHours: 5.5861, decDegrees: -5.1769 },
      fieldDegrees: { width: 3.15, height: 2.16 },
    })
    expect(notes).toContain('Centre: 5h 35m 10s · -5° 10′ 37″')
    expect(notes).toContain('Field of view: 3.15° × 2.16°')
  })

  it('leaves out what the plan did not say', () => {
    const notes = planNotes({ target: 'M42', equipment: {}, filters: [{ filter: 'L', subs: 1, exposureSeconds: 60 }] })
    expect(notes).not.toMatch(/Source|Equipment|Centre|Field of view/)
  })
})

describe('buildPlan', () => {
  it('creates a planning project that carries the plan details in its notes', () => {
    const { project } = buildPlan(input)
    expect(project).toMatchObject({ goalHours: '25', status: 'planning' })
    expect(project.notes).toBe(planNotes(plan))
  })

  it('uses the target and project name the user settled on, not the plan title', () => {
    const { project } = buildPlan({ ...input, target: '  NGC 1333  ', projectName: '  Dusty region  ' })
    expect(project).toMatchObject({ target: 'NGC 1333', projectName: 'Dusty region' })
    expect(project.notes).toContain('Title: M31 - Andromeda Galaxy')
  })

  it('leaves the project name unset when it is blank', () => {
    expect(buildPlan({ ...input, projectName: '   ' }).project.projectName).toBeUndefined()
  })

  it('creates one dated planning session per night, linked to the project', () => {
    const { project, sessions } = buildPlan({ ...input, location: ' Backyard ' })
    expect(sessions.map((s) => s.date)).toEqual(['2026-11-01', '2026-11-05', '2026-11-09', '2026-11-13'])
    expect(sessions.every((s) => s.projectId === project.id && s.status === 'planning')).toBe(true)
    expect(sessions[0].location).toBe('Backyard')
  })

  it('leaves location unset when blank', () => {
    expect(buildPlan(input).sessions[0].location).toBeUndefined()
  })

  it('puts one filter on each night, with that filter alone on the session', () => {
    const { sessions, frames } = buildPlan(input)
    // Nights 1-2 are L, nights 3-4 are Ha.
    expect(sessions.map((s) => s.gear?.filters?.map((f) => f.id))).toEqual([['f-l'], ['f-l'], ['f-ha'], ['f-ha']])
    for (const session of sessions) {
      const lights = frames.filter((f) => f.sessionId === session.id && f.frameType === 'light')
      expect(lights).toHaveLength(1)
    }
  })

  it('attaches no equipment to the sessions', () => {
    const { sessions } = buildPlan(input)
    expect(sessions[0].gear?.camera).toBeUndefined()
    expect(sessions[0].gear?.telescope).toBeUndefined()
    expect(sessions[0].gear?.mount).toBeUndefined()
  })

  it('splits light frames across nights without losing any', () => {
    const { frames } = buildPlan(input)
    const lights = frames.filter((f) => f.frameType === 'light')
    const total = (filterId: string) => lights.filter((f) => f.filterId === filterId).reduce((n, f) => n + f.count, 0)
    expect(total('f-l')).toBe(159)
    expect(total('f-ha')).toBe(101)
    expect(lights.map((f) => f.count)).toEqual([80, 79, 51, 50])
    expect(lights.every((f) => f.exposureSeconds === 300 && f.status === 'planning')).toBe(true)
  })

  it('keeps every night within the hours per night', () => {
    const { sessions, frames } = buildPlan(input)
    for (const session of sessions) {
      const seconds = frames
        .filter((f) => f.sessionId === session.id && f.frameType === 'light')
        .reduce((n, f) => n + f.count * f.exposureSeconds, 0)
      expect(seconds).toBeLessThanOrEqual(8 * 3600)
    }
  })

  it('gives each session a flat and a matching flat-dark for its filter', () => {
    const { sessions, frames } = buildPlan(input)
    for (const session of sessions) {
      const mine = frames.filter((f) => f.sessionId === session.id)
      const filterId = session.gear?.filters?.[0]?.id
      const flat = mine.find((f) => f.frameType === 'flat')
      const flatDark = mine.find((f) => f.frameType === 'flat-dark')
      expect(flat).toMatchObject({ filterId, count: 20, exposureSeconds: 0, status: 'planning' })
      expect(flatDark).toMatchObject({ filterId, count: 20, exposureSeconds: flat?.exposureSeconds })
      expect(mine).toHaveLength(3) // light, flat, flat-dark
    }
  })

  it('gives a flat for each filter that shares a night', () => {
    const shared = planNights(plan.filters, ['f-l', 'f-ha'], 24, true)
    expect(shared).toHaveLength(1)
    const { sessions, frames } = buildPlan({ ...input, nights: shared, dates: ['2026-11-01'] })
    expect(sessions[0].gear?.filters?.map((f) => f.id)).toEqual(['f-l', 'f-ha'])
    expect(frames.filter((f) => f.frameType === 'light')).toHaveLength(2)
    expect(frames.filter((f) => f.frameType === 'flat')).toHaveLength(2)
    expect(frames.filter((f) => f.frameType === 'flat-dark')).toHaveLength(2)
  })

  it('links every frame to its project and session, with a name for its filter', () => {
    const { project, sessions, frames } = buildPlan(input)
    expect(frames.every((f) => f.projectId === project.id && sessions.some((s) => s.id === f.sessionId))).toBe(true)
    expect(frames.find((f) => f.filterId === 'f-ha')?.filterName).toBe('Ha')
  })

  it('makes no session, and no frames, for a filter the user chose to skip', () => {
    const skipped = planNights(plan.filters, ['f-l', ''], 8, false)
    const { sessions, frames } = buildPlan({ ...input, filterIds: ['f-l', ''], nights: skipped, dates: ['2026-11-01', '2026-11-05'] })
    expect(sessions).toHaveLength(2)
    expect(frames.some((f) => f.filterId === 'f-ha')).toBe(false)
  })

  it('makes one flat per filter even when a filter has two exposure lengths', () => {
    const twice: ProjectPlan = {
      ...plan,
      filters: [
        { filter: 'L', subs: 10, exposureSeconds: 300 },
        { filter: 'L', subs: 10, exposureSeconds: 180 },
      ],
    }
    const one = planNights(twice.filters, ['f-l', 'f-l'], 8, false)
    const { frames } = buildPlan({ ...input, plan: twice, filterIds: ['f-l', 'f-l'], nights: one, dates: ['2026-11-01'] })
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
