import { describe, expect, it } from 'vitest'
import { MAX_FILTER_ROWS, PLAN_PROMPT, parsePlan } from './planParse'

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

describe('PLAN_PROMPT', () => {
  it('contains an example the parser accepts', () => {
    const example = PLAN_PROMPT.slice(PLAN_PROMPT.indexOf('{'), PLAN_PROMPT.indexOf('\n}\n') + 2)
    expect(parsePlan(example).ok).toBe(true)
  })
})
