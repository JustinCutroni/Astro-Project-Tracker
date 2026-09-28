import type { FrameType } from '../types/models'

// Parses a ZWO ASIAIR "Autorun_Log_*.txt" file. These logs record what the
// autorun plan actually did, not a structured export, so this is regex
// scraping of a line-oriented log rather than parsing a real format.
//
// What the log does NOT contain (so these are left for the user to fill in
// during review): which filter was mounted, gain, offset, and location.
// ASIAIR doesn't write any of those to this log.

export interface ParsedFrameBatch {
  frameType: FrameType
  exposureSeconds: number
  binning: string
  plannedCount: number
  actualCount: number
  tempF?: number
  associatedTarget?: string
}

export interface ParsedAsiairLog {
  sessionDate?: string // YYYY-MM-DD
  batches: ParsedFrameBatch[]
  warnings: string[]
}

const LINE_RE = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}:\d{2}:\d{2}) (.*)$/
const RECONNECT_RE = /^Log enabled at/i
const TEMP_RE = /temperature\s+([\d.]+)\s*(?:℉|°F|F\b)/i
const TARGET_RE = /\[Autorun\|Begin\]\s+(.+?)\s+Start\s*$/
const SHOOTING_RE =
  /^Shooting\s+(\d+)\s+(flat dark|light|dark|flat|bias)\s+frames?,\s*(?:exposure\s+([\d.]+)\s*(ms|s)|auto-exposure)\s*Bin(\d+)/i
const EXPOSURE_RE = /^Exposure\s+([\d.]+)\s*(ms|s)\s+image\s+(\d+)#/i
const BATCH_END_RE = /\[Autorun\|End\]|Stop Autorun|^Pause Plan/i

// Two batches that share these count as the same shooting plan, just split
// across a pause/resume (or an ASIAIR disconnect/reconnect) rather than two
// separate intentional runs - ASIAIR doesn't shoot the identical target at
// the identical settings twice on purpose.
function batchKey(b: ParsedFrameBatch): string {
  return `${b.frameType}|${b.exposureSeconds}|${b.binning}|${b.associatedTarget ?? ''}`
}

function toSeconds(value: string, unit: string): number {
  const n = parseFloat(value)
  const seconds = unit.toLowerCase() === 'ms' ? n / 1000 : n
  return Math.round(seconds * 10000) / 10000
}

function normalizeFrameType(raw: string): FrameType {
  const key = raw.toLowerCase()
  if (key === 'flat dark') return 'flat-dark'
  return key as FrameType
}

export function parseAsiairAutorunLog(text: string): ParsedAsiairLog {
  const warnings: string[] = []
  const batches: ParsedFrameBatch[] = []
  let sessionDate: string | undefined
  let lastTemp: number | undefined
  let lastTarget: string | undefined
  let current: ParsedFrameBatch | null = null

  function finalizeCurrent() {
    if (current) {
      if (current.actualCount > 0) {
        batches.push(current)
      } else {
        warnings.push(
          `Skipped a ${current.frameType} batch that recorded 0 completed frames (planned ${current.plannedCount}).`,
        )
      }
    }
    current = null
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    // ASIAIR reconnecting means an unknown gap - the last temperature we saw
    // could be hours stale by the time shooting resumes, so treat it as
    // unknown again rather than carrying a misleading reading forward.
    if (RECONNECT_RE.test(line)) {
      lastTemp = undefined
      continue
    }

    const lineMatch = LINE_RE.exec(line)
    if (!lineMatch) continue

    const [, year, month, day, , rest] = lineMatch
    if (!sessionDate) sessionDate = `${year}-${month}-${day}`

    const tempMatch = TEMP_RE.exec(rest)
    if (tempMatch) lastTemp = parseFloat(tempMatch[1])

    const targetMatch = TARGET_RE.exec(rest)
    if (targetMatch) lastTarget = targetMatch[1]

    const shootingMatch = SHOOTING_RE.exec(rest)
    if (shootingMatch) {
      finalizeCurrent()
      const [, plannedCount, frameType, expValue, expUnit, binVal] = shootingMatch
      current = {
        frameType: normalizeFrameType(frameType),
        exposureSeconds: expValue ? toSeconds(expValue, expUnit) : 0,
        binning: `${binVal}x${binVal}`,
        plannedCount: parseInt(plannedCount, 10),
        actualCount: 0,
        tempF: lastTemp,
        associatedTarget: lastTarget,
      }
      continue
    }

    const exposureMatch = EXPOSURE_RE.exec(rest)
    if (exposureMatch && current) {
      const [, expValue, expUnit, imageNum] = exposureMatch
      current.actualCount = Math.max(current.actualCount, parseInt(imageNum, 10))
      current.exposureSeconds = toSeconds(expValue, expUnit)
      continue
    }

    if (BATCH_END_RE.test(rest)) {
      finalizeCurrent()
    }
  }
  finalizeCurrent()

  // Merge batches split by a pause/resume or a disconnect/reconnect back
  // into one: same target, frame type, exposure, and binning means it's a
  // continuation of the same shooting plan, so the counts should add up to
  // one "N of planned" total rather than reporting two partial batches.
  const merged: ParsedFrameBatch[] = []
  const mergedIndexByKey = new Map<string, number>()
  for (const batch of batches) {
    const key = batchKey(batch)
    const existingIndex = mergedIndexByKey.get(key)
    if (existingIndex === undefined) {
      mergedIndexByKey.set(key, merged.length)
      merged.push({ ...batch })
    } else {
      const existing = merged[existingIndex]
      existing.actualCount += batch.actualCount
      existing.plannedCount = Math.max(existing.plannedCount, batch.plannedCount)
      if (existing.tempF === undefined) existing.tempF = batch.tempF
    }
  }

  if (!sessionDate) {
    warnings.push('Could not find any timestamped lines - is this an ASIAIR Autorun log file?')
  }
  if (merged.length === 0) {
    warnings.push('No frame batches were recognized in this log.')
  }

  return { sessionDate, batches: merged, warnings }
}
