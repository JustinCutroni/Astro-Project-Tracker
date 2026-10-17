import { describe, expect, it } from 'vitest'
import { MAX_FILTER_ROWS, PLAN_PROMPT, SKILL_PROMPT, parsePlan } from './planParse'

const validPlan = {
  target: 'M31 - Andromeda Galaxy',
  goalHours: '25',
  source: 'https://www.astrobin.com/abc123/',
  equipment: { camera: 'ASI2600MM Pro', telescope: 'Redcat 51', mount: 'AM5' },
  filters: [
    { filter: 'L', subs: 159, exposureSeconds: 300 },
    { filter: 'Hα', subs: 101, exposureSeconds: 300 },
  ],
}

const errorOf = (text: string) => {
  const result = parsePlan(text)
  return result.ok ? undefined : result.error
}

describe('parsePlan', () => {
  it('reads a complete plan', () => {
    const result = parsePlan(JSON.stringify(validPlan))
    expect(result).toEqual({ ok: true, plan: validPlan })
  })

  it('reads a plan wrapped in a code fence and chatter', () => {
    const text = `Here you go!\n\`\`\`json\n${JSON.stringify(validPlan)}\n\`\`\`\nClear skies.`
    expect(parsePlan(text).ok).toBe(true)
  })

  it('needs only a target and one filter; the rest is optional', () => {
    const result = parsePlan('{"target":"M42","filters":[{"filter":"L","subs":10,"exposureSeconds":60}]}')
    expect(result).toEqual({
      ok: true,
      plan: {
        target: 'M42',
        goalHours: undefined,
        source: undefined,
        coordinates: undefined,
        fieldDegrees: undefined,
        equipment: { camera: undefined, telescope: undefined, mount: undefined },
        filters: [{ filter: 'L', subs: 10, exposureSeconds: 60 }],
      },
    })
  })

  it('accepts numbers written as text', () => {
    const result = parsePlan('{"target":"M42","goalHours":12,"filters":[{"filter":"L","subs":"10","exposureSeconds":"60"}]}')
    expect(result.ok && result.plan.filters[0]).toEqual({ filter: 'L', subs: 10, exposureSeconds: 60 })
    expect(result.ok && result.plan.goalHours).toBe('12')
  })

  it('keeps emoji and special characters as plain text', () => {
    const result = parsePlan('{"target":"M31 ✨ <b>Andromeda</b>","filters":[{"filter":"L","subs":1,"exposureSeconds":1}]}')
    expect(result.ok && result.plan.target).toBe('M31 ✨ <b>Andromeda</b>')
  })

  it('explains each way a plan can be wrong', () => {
    expect(errorOf('')).toMatch(/No plan found/)
    expect(errorOf('just words')).toMatch(/No plan found/)
    expect(errorOf('{"target": }')).toMatch(/not valid JSON/)
    expect(errorOf('{"filters":[{"filter":"L","subs":1,"exposureSeconds":1}]}')).toMatch(/"target"/)
    expect(errorOf('{"target":"M42"}')).toMatch(/"filters"/)
    expect(errorOf('{"target":"M42","filters":[]}')).toMatch(/"filters"/)
    expect(errorOf('{"target":"M42","filters":["L"]}')).toMatch(/Filter row 1/)
    expect(errorOf('{"target":"M42","equipment":[],"filters":[{"filter":"L","subs":1,"exposureSeconds":1}]}')).toMatch(/equipment/)
    expect(errorOf('{"target":{"a":1},"filters":[{"filter":"L","subs":1,"exposureSeconds":1}]}')).toMatch(/"target"/)
  })

  it('rejects zero, negative, fractional and huge numbers', () => {
    const row = (subs: unknown, exposureSeconds: unknown) =>
      JSON.stringify({ target: 'M42', filters: [{ filter: 'L', subs, exposureSeconds }] })
    expect(errorOf(row(0, 60))).toMatch(/subs/)
    expect(errorOf(row(-5, 60))).toMatch(/subs/)
    expect(errorOf(row(1.5, 60))).toMatch(/subs/)
    expect(errorOf(row(10001, 60))).toMatch(/subs/)
    expect(errorOf(row(10, 0))).toMatch(/exposureSeconds/)
    expect(errorOf(row(10, -1))).toMatch(/exposureSeconds/)
    expect(errorOf(row(10, 3601))).toMatch(/exposureSeconds/)
    expect(errorOf(row(null, 60))).toMatch(/subs/)
    expect(errorOf(row('lots', 60))).toMatch(/subs/)
  })

  it('rejects too many filters and over-long text', () => {
    const rows = Array.from({ length: MAX_FILTER_ROWS + 1 }, () => ({ filter: 'L', subs: 1, exposureSeconds: 1 }))
    expect(errorOf(JSON.stringify({ target: 'M42', filters: rows }))).toMatch(/more than/)
    expect(errorOf(JSON.stringify({ ...validPlan, target: 'x'.repeat(101) }))).toMatch(/too long/)
    expect(errorOf('x'.repeat(20001))).toMatch(/too long/)
  })
})

describe('position and field of view', () => {
  const withExtras = (extras: object) =>
    JSON.stringify({ target: 'M42', filters: [{ filter: 'L', subs: 1, exposureSeconds: 1 }], ...extras })

  it('reads the centre and field of view', () => {
    const result = parsePlan(withExtras({ ra: 5.5861, dec: -5.1769, fieldWidthDeg: 3.15, fieldHeightDeg: 2.16 }))
    expect(result.ok && result.plan.coordinates).toEqual({ raHours: 5.5861, decDegrees: -5.1769 })
    expect(result.ok && result.plan.fieldDegrees).toEqual({ width: 3.15, height: 2.16 })
  })

  it('accepts them written as text, including a negative declination', () => {
    const result = parsePlan(withExtras({ ra: '5.5861', dec: '-5.1769' }))
    expect(result.ok && result.plan.coordinates).toEqual({ raHours: 5.5861, decDegrees: -5.1769 })
  })

  it('accepts a plan without them', () => {
    const result = parsePlan(withExtras({}))
    expect(result.ok && result.plan.coordinates).toBeUndefined()
    expect(result.ok && result.plan.fieldDegrees).toBeUndefined()
  })

  it('rejects half a position, or one out of range', () => {
    expect(errorOf(withExtras({ ra: 5.5 }))).toMatch(/"ra" and "dec"/)
    expect(errorOf(withExtras({ dec: 5.5 }))).toMatch(/"ra" and "dec"/)
    expect(errorOf(withExtras({ ra: 24, dec: 0 }))).toMatch(/"ra" and "dec"/)
    expect(errorOf(withExtras({ ra: -1, dec: 0 }))).toMatch(/"ra" and "dec"/)
    expect(errorOf(withExtras({ ra: 5, dec: 91 }))).toMatch(/"ra" and "dec"/)
    expect(errorOf(withExtras({ ra: 'five', dec: 0 }))).toMatch(/"ra" and "dec"/)
  })

  it('rejects half a field of view, or an impossible one', () => {
    expect(errorOf(withExtras({ fieldWidthDeg: 3 }))).toMatch(/fieldWidthDeg/)
    expect(errorOf(withExtras({ fieldWidthDeg: 0, fieldHeightDeg: 2 }))).toMatch(/fieldWidthDeg/)
    expect(errorOf(withExtras({ fieldWidthDeg: 181, fieldHeightDeg: 2 }))).toMatch(/fieldWidthDeg/)
  })
})

describe('an AI that could not finish', () => {
  it("shows the AI's own reason instead of a generic complaint", () => {
    expect(errorOf('{"error":"The AstroBin image page could not be opened."}')).toBe(
      'Your AI could not finish the plan: The AstroBin image page could not be opened.',
    )
  })

  it('keeps a very long reason short', () => {
    const message = errorOf(JSON.stringify({ error: 'x'.repeat(5000) }))
    expect(message && message.length).toBeLessThan(400)
  })

  it('treats an empty error as no error', () => {
    expect(errorOf('{"error":"","filters":[]}')).toMatch(/"target"/)
  })
})

describe('SKILL_PROMPT', () => {
  it('names the skill and leaves room for the link', () => {
    expect(SKILL_PROMPT).toBe('Use $astrobin-extractor on [paste the AstroBin link here]')
  })
})

describe('PLAN_PROMPT', () => {
  it('contains an example the parser accepts', () => {
    const example = PLAN_PROMPT.slice(PLAN_PROMPT.indexOf('{'), PLAN_PROMPT.indexOf('\n}\n') + 2)
    expect(parsePlan(example).ok).toBe(true)
  })
})
