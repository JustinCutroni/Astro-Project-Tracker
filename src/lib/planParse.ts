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
  coordinates?: { raHours: number; decDegrees: number } // centre of the image
  fieldDegrees?: { width: number; height: number } // how much sky the image covers
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
const MAX_ERROR_CHARS = 300

// What the "Copy AI prompt" buttons hand to an AI, so its answer is exactly
// what parsePlan reads. Keep them in step with it.

// For ChatGPT with the user's astrobin-extractor skill, which already knows the format.
export const SKILL_PROMPT = 'Use $astrobin-extractor on [paste the AstroBin link here]'

// For any other AI: the format spelled out.
export const PLAN_PROMPT = `Reply with ONLY a JSON object in this exact shape (no other text):

{
  "target": "M42 - Orion Nebula",
  "goalHours": "27.2",
  "source": "https://app.astrobin.com/i/xxxxxx",
  "ra": 5.5861,
  "dec": -5.1769,
  "fieldWidthDeg": 3.15,
  "fieldHeightDeg": 2.16,
  "equipment": { "camera": "ASI2600MM Pro", "telescope": "Redcat 51", "mount": "AM5" },
  "filters": [
    { "filter": "L", "subs": 159, "exposureSeconds": 300 },
    { "filter": "Ha", "subs": 101, "exposureSeconds": 300 }
  ]
}

Rules:
- Use only information I give you or that is shown on the page. Do not guess; leave out any field you do not know, except "filters".
- "filters" has one entry per filter and exposure length: "subs" is the number of frames, "exposureSeconds" is the length of one frame in seconds. "30×300s" means subs 30, exposureSeconds 300.
- Do not include a Total row.
- Name filters L, R, G, B, Ha, OIII or S where possible.
- "goalHours" is the total integration time in hours, rounded to one decimal place.
- "ra" is the right ascension of the image centre in decimal hours (5h 35m 10s is 5.5861). "dec" is the declination in decimal degrees (-5° 10′ 37″ is -5.1769). Give both or neither.
- "fieldWidthDeg" and "fieldHeightDeg" are the sky area the image covers, in degrees. Give both or neither.
- If you cannot complete the plan, reply with only {"error": "<short reason>"}.`

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
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value)
  return NaN
}

const isBlank = (value: unknown) => value === undefined || value === null || value === ''

// Both numbers or neither: half a position is no position.
function parseCoordinates(raw: Record<string, unknown>): ProjectPlan['coordinates'] {
  if (isBlank(raw.ra) && isBlank(raw.dec)) return undefined
  const ra = numberField(raw.ra)
  const dec = numberField(raw.dec)
  if (!(ra >= 0 && ra < 24) || !(dec >= -90 && dec <= 90)) {
    throw new PlanError('"ra" and "dec" must both be given: ra in hours (0 up to 24), dec in degrees (-90 to 90).')
  }
  return { raHours: ra, decDegrees: dec }
}

function parseFieldDegrees(raw: Record<string, unknown>): ProjectPlan['fieldDegrees'] {
  if (isBlank(raw.fieldWidthDeg) && isBlank(raw.fieldHeightDeg)) return undefined
  const width = numberField(raw.fieldWidthDeg)
  const height = numberField(raw.fieldHeightDeg)
  if (!(width > 0 && width <= 180) || !(height > 0 && height <= 180)) {
    throw new PlanError('"fieldWidthDeg" and "fieldHeightDeg" must both be given, in degrees above 0 and at most 180.')
  }
  return { width, height }
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

    // The prompts tell the AI to answer {"error": "..."} when it cannot finish.
    if (typeof raw.error === 'string' && raw.error.trim()) {
      throw new PlanError(`Your AI could not finish the plan: ${raw.error.trim().slice(0, MAX_ERROR_CHARS)}`)
    }

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
        coordinates: parseCoordinates(raw),
        fieldDegrees: parseFieldDegrees(raw),
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
