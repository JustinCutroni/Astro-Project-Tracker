// Reads a project plan pasted from an AI chat. The plan is plain JSON; the
// app never fetches anything, so it works offline and keeps no keys.

export interface PlanFilterRow {
  filter: string // as the source named it ("Lum/Clear", "Hα"); matched to the catalog later
  subs: number
  exposureSeconds: number
}

export interface ProjectPlan {
  target: string
  goalHours?: string
  source?: string // e.g. an AstroBin link; kept in the project notes
  equipment: { camera?: string; telescope?: string; mount?: string }
  filters: PlanFilterRow[]
}

export type ParseResult = { ok: true; plan: ProjectPlan } | { ok: false; error: string }

export const MAX_PLAN_CHARS = 20000
export const MAX_FILTER_ROWS = 12
const MAX_SUBS = 10000
const MAX_EXPOSURE_SECONDS = 3600
const MAX_NAME_CHARS = 100
const MAX_SOURCE_CHARS = 500

// The instructions the "Copy AI prompt" button hands to an AI, so its answer
// is exactly what parsePlan reads. Keep the two in step.
export const PLAN_PROMPT = `Reply with ONLY a JSON object in this exact shape (no other text):

{
  "target": "M31 - Andromeda Galaxy",
  "goalHours": "25",
  "source": "https://www.astrobin.com/xxxxxx/",
  "equipment": { "camera": "ASI2600MM Pro", "telescope": "Redcat 51", "mount": "AM5" },
  "filters": [
    { "filter": "L", "subs": 159, "exposureSeconds": 300 },
    { "filter": "R", "subs": 15, "exposureSeconds": 300 },
    { "filter": "Ha", "subs": 101, "exposureSeconds": 300 }
  ]
}

Rules:
- "filters" has one entry per filter in the acquisition table: "subs" is the number of sub-exposures, "exposureSeconds" is the length of one sub in seconds.
- Do not include a Total row.
- Name filters L, R, G, B, Ha, OIII or S where possible.
- "goalHours" is the total integration time in hours. Leave out any field you do not know.`

class PlanError extends Error {}

function textField(value: unknown, label: string, maxChars: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' && typeof value !== 'number') throw new PlanError(`"${label}" must be text.`)
  const text = String(value).trim()
  if (text.length > maxChars) throw new PlanError(`"${label}" is too long (over ${maxChars} characters).`)
  return text || undefined
}

function numberField(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) return Number(value)
  return NaN
}

function parseRow(row: unknown, index: number): PlanFilterRow {
  const label = `Filter row ${index + 1}`
  if (typeof row !== 'object' || row === null || Array.isArray(row)) throw new PlanError(`${label} is not an object.`)
  const { filter, subs, exposureSeconds } = row as Record<string, unknown>

  const name = textField(filter, `${label} filter`, MAX_NAME_CHARS)
  if (!name) throw new PlanError(`${label} needs a "filter" name.`)

  const subCount = numberField(subs)
  if (!Number.isInteger(subCount) || subCount < 1 || subCount > MAX_SUBS) {
    throw new PlanError(`${label} ("${name}") needs "subs" as a whole number from 1 to ${MAX_SUBS}.`)
  }
  const exposure = numberField(exposureSeconds)
  if (!(exposure > 0) || exposure > MAX_EXPOSURE_SECONDS) {
    throw new PlanError(`${label} ("${name}") needs "exposureSeconds" above 0 and at most ${MAX_EXPOSURE_SECONDS}.`)
  }
  return { filter: name, subs: subCount, exposureSeconds: exposure }
}

// AI answers often arrive wrapped in a ```json fence or a sentence of
// chatter, so take everything from the first "{" to the last "}".
function extractJsonText(text: string): string | undefined {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return start === -1 || end <= start ? undefined : text.slice(start, end + 1)
}

export function parsePlan(text: string): ParseResult {
  try {
    if (text.length > MAX_PLAN_CHARS) throw new PlanError('That is too long to be a plan.')
    const jsonText = extractJsonText(text)
    if (!jsonText) throw new PlanError('No plan found. Paste the JSON your AI wrote.')

    let data: unknown
    try {
      data = JSON.parse(jsonText)
    } catch {
      throw new PlanError('That is not valid JSON. Ask your AI to resend the plan.')
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new PlanError('The plan must be a JSON object.')
    const raw = data as Record<string, unknown>

    const target = textField(raw.target, 'target', MAX_NAME_CHARS)
    if (!target) throw new PlanError('The plan needs a "target".')

    if (!Array.isArray(raw.filters) || raw.filters.length === 0) {
      throw new PlanError('The plan needs a "filters" list with at least one filter.')
    }
    if (raw.filters.length > MAX_FILTER_ROWS) throw new PlanError(`The plan has more than ${MAX_FILTER_ROWS} filters.`)

    const equipment = raw.equipment ?? {}
    if (typeof equipment !== 'object' || Array.isArray(equipment)) throw new PlanError('"equipment" must be an object.')
    const gear = equipment as Record<string, unknown>

    return {
      ok: true,
      plan: {
        target,
        goalHours: textField(raw.goalHours, 'goalHours', 20),
        source: textField(raw.source, 'source', MAX_SOURCE_CHARS),
        equipment: {
          camera: textField(gear.camera, 'camera', MAX_NAME_CHARS),
          telescope: textField(gear.telescope, 'telescope', MAX_NAME_CHARS),
          mount: textField(gear.mount, 'mount', MAX_NAME_CHARS),
        },
        filters: raw.filters.map(parseRow),
      },
    }
  } catch (err) {
    if (err instanceof PlanError) return { ok: false, error: err.message }
    throw err
  }
}
