import type { FrameType } from '../types/models'

// Parses a ZWO ASIAIR "Autorun_Log_*.txt" file. These logs record what the
// autorun plan actually did, not a structured export, so this is regex
// scraping of a line-oriented log rather than parsing a real format.
//
// Things worth knowing about the format (all learned from real logs):
// - "Exposure Ns image K#" is written when an exposure STARTS, and K counts
//   up across the whole plan, continuing through filter changes (a 25-frame
//   batch followed by a 45-frame batch numbers its images 1-25 then 26-70).
//   It restarts at 1 whenever the plan is restarted.
// - "Filter change, S change to H" names the filters by a one-letter code
//   but is only written when the filter actually changes, so the filter for
//   a batch is known only when a change line precedes it (or follows it, for
//   the very first batch in the log).
// - A log file is often several runs stitched together: every pause/stop
//   writes "Log disabled", and every restart "Log enabled", so one file can
//   hold abandoned attempts (guiding failures, a slew that failed, ...).
//
// What the log does NOT contain: gain, offset, location, and the filter for
// any batch that has no filter-change line to go on. Those are left for the
// user to fill in during review.

export interface ParsedFrameBatch {
  frameType: FrameType
  exposureSeconds: number
  binning: string
  plannedCount: number
  actualCount: number
  tempF?: number
  associatedTarget?: string
  // One-letter code from a "Filter change" line (e.g. "H"), if known.
  filterCode?: string
  // Frames whose exposure overlapped a guide-star-lost event, so may be
  // trailed. They are still counted in actualCount; this is a heads-up.
  suspectCount: number
  // Plain-language caveats shown to the user while reviewing this batch.
  notes: string[]
}

export interface ParsedAsiairLog {
  sessionDate?: string // YYYY-MM-DD
  batches: ParsedFrameBatch[]
  warnings: string[]
}

// One "Shooting N ... frames" stretch inside a single run, before merging.
interface Segment {
  frameType: FrameType
  exposureSeconds: number
  binning: string
  plannedCount: number
  target?: string
  filterCode?: string
  needsInitialFilter: boolean
  temps: number[]
  fallbackTemp?: number
  // image number -> start time (ms)
  starts: Map<number, number>
  guideProblemTimes: number[]
  runStartedAt: string // HH:MM, for notes
}

const LINE_RE = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2}) (.*)$/
const RECONNECT_RE = /^Log enabled at/i
const DISABLED_RE = /^Log disabled at/i
const TEMP_RE = /temperature\s+([\d.]+)\s*(?:℉|°F|F\b)/i
const TARGET_RE = /\[Autorun\|Begin\]\s+(.+?)\s+Start\s*$/
const SHOOTING_RE =
  /^Shooting\s+(\d+)\s+(flat dark|light|dark|flat|bias)\s+frames?,\s*(?:exposure\s+([\d.]+)\s*(ms|s)|auto-exposure)\s*Bin(\d+)/i
const EXPOSURE_RE = /^Exposure\s+([\d.]+)\s*(ms|s)\s+image\s+(\d+)#/i
const FILTER_CHANGE_RE = /^Filter change,\s*(\S+)\s+change to\s+(\S+)/i
const GUIDE_PROBLEM_RE = /\[Guide\]\s+(?:Guide star lost|Select Guide Star failed)/i
const BATCH_END_RE = /\[Autorun\|End\]|Stop Autorun|^Pause Plan/i

// Timestamps only have 1s resolution, so allow a little slack when deciding
// whether the last exposure before a stop had time to finish.
const COMPLETION_SLACK_MS = 1500

// Two segments that share these count as the same shooting plan, just split
// across a pause/resume (or an ASIAIR disconnect/reconnect) rather than two
// separate intentional runs - ASIAIR doesn't shoot the identical target at
// the identical settings and filter twice on purpose.
function mergeKey(s: Segment): string {
  const target = s.frameType === 'light' ? (s.target ?? '') : ''
  return `${s.frameType}|${s.exposureSeconds}|${s.binning}|${s.filterCode ?? ''}|${target}`
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

function mean(values: number[]): number {
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

export function parseAsiairAutorunLog(text: string): ParsedAsiairLog {
  const warnings: string[] = []
  const segments: Segment[] = []
  const completedCounts = new Map<Segment, { count: number; suspect: number }>()
  let sessionDate: string | undefined
  let lastTemp: number | undefined
  let lastTarget: string | undefined
  let currentFilter: string | undefined
  let sawFilterChange = false
  let runStartedAt = ''
  let lastTs = 0
  let current: Segment | null = null

  // Closes the current segment at time `endTs` (the moment whatever ended it
  // was logged) and works out how many frames really finished.
  function finalizeCurrent(endTs: number) {
    const seg = current
    current = null
    if (!seg) return

    const numbers = [...seg.starts.keys()].sort((a, b) => a - b)
    let count = 0
    let suspect = 0
    numbers.forEach((n, i) => {
      const start = seg.starts.get(n) as number
      const nextStart = i + 1 < numbers.length ? seg.starts.get(numbers[i + 1]) : undefined
      const finishedBy = nextStart ?? endTs
      const exposureMs = seg.exposureSeconds * 1000
      // An exposure that was still running when the log stopped never
      // produced a frame, unless its full length had already elapsed.
      const finished = nextStart !== undefined || finishedBy - start + COMPLETION_SLACK_MS >= exposureMs
      if (!finished) return
      count++
      if (
        seg.guideProblemTimes.some((t) => t >= start && t <= start + exposureMs + COMPLETION_SLACK_MS)
      ) {
        suspect++
      }
    })

    if (count === 0) {
      const what = seg.frameType === 'light' && seg.target ? ` on ${seg.target}` : ''
      warnings.push(
        `Skipped an abandoned ${seg.frameType} run${what} at ${seg.runStartedAt}: no frames finished (planned ${seg.plannedCount}).`,
      )
      return
    }
    segments.push(seg)
    completedCounts.set(seg, { count, suspect })
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
    if (DISABLED_RE.test(line)) {
      finalizeCurrent(lastTs)
      continue
    }

    const lineMatch = LINE_RE.exec(line)
    if (!lineMatch) continue

    const [, year, month, day, hh, mm, ss, rest] = lineMatch
    const ts = Date.UTC(+year, +month - 1, +day, +hh, +mm, +ss)
    lastTs = ts
    if (!sessionDate) sessionDate = `${year}-${month}-${day}`

    const targetMatch = TARGET_RE.exec(rest)
    if (targetMatch) {
      lastTarget = targetMatch[1]
      runStartedAt = `${hh}:${mm}`
    }

    const tempMatch = TEMP_RE.exec(rest)
    if (tempMatch) {
      const t = parseFloat(tempMatch[1])
      lastTemp = t
      if (current) current.temps.push(t)
    }

    const filterMatch = FILTER_CHANGE_RE.exec(rest)
    if (filterMatch) {
      const [, from, to] = filterMatch
      if (!sawFilterChange) {
        // Everything shot before the first change line was shot through the
        // filter that change moved away from.
        for (const s of segments) if (s.needsInitialFilter) s.filterCode = from
      }
      sawFilterChange = true
      currentFilter = to
      // The change line is written right after "Shooting N ...", so it
      // belongs to the batch that just started.
      if (current) {
        current.filterCode = to
        current.needsInitialFilter = false
      }
      continue
    }

    if (GUIDE_PROBLEM_RE.test(rest)) {
      if (current) current.guideProblemTimes.push(ts)
      continue
    }

    const shootingMatch = SHOOTING_RE.exec(rest)
    if (shootingMatch) {
      finalizeCurrent(ts)
      const [, plannedCount, frameType, expValue, expUnit, binVal] = shootingMatch
      const type = normalizeFrameType(frameType)
      current = {
        frameType: type,
        exposureSeconds: expValue ? toSeconds(expValue, expUnit) : 0,
        binning: `${binVal}x${binVal}`,
        plannedCount: parseInt(plannedCount, 10),
        // "[Autorun|Begin] X Start" is the target for lights, but for
        // calibration frames it is just the plan's name (e.g. a date).
        target: type === 'light' ? lastTarget : undefined,
        filterCode: currentFilter,
        needsInitialFilter: currentFilter === undefined,
        temps: [],
        fallbackTemp: lastTemp,
        starts: new Map(),
        guideProblemTimes: [],
        runStartedAt,
      }
      continue
    }

    const exposureMatch = EXPOSURE_RE.exec(rest)
    if (exposureMatch && current) {
      const [, expValue, expUnit, imageNum] = exposureMatch
      current.exposureSeconds = toSeconds(expValue, expUnit)
      const n = parseInt(imageNum, 10)
      if (!current.starts.has(n)) current.starts.set(n, ts)
      continue
    }

    if (BATCH_END_RE.test(rest)) {
      finalizeCurrent(ts)
    }
  }
  finalizeCurrent(lastTs)

  // Merge segments split by a pause/resume or a disconnect/reconnect back
  // into one: same target, frame type, exposure, binning, and filter means
  // it's a continuation of the same shooting plan.
  const merged: ParsedFrameBatch[] = []
  const mergedIndexByKey = new Map<string, number>()
  const mergedParts = new Map<number, number[]>()
  for (const seg of segments) {
    const info = completedCounts.get(seg) as { count: number; suspect: number }
    const temp = seg.temps.length > 0 ? mean(seg.temps) : seg.fallbackTemp
    const key = mergeKey(seg)
    const existingIndex = mergedIndexByKey.get(key)
    if (existingIndex === undefined) {
      mergedIndexByKey.set(key, merged.length)
      mergedParts.set(merged.length, [info.count])
      merged.push({
        frameType: seg.frameType,
        exposureSeconds: seg.exposureSeconds,
        binning: seg.binning,
        plannedCount: seg.plannedCount,
        actualCount: info.count,
        tempF: temp,
        associatedTarget: seg.target,
        filterCode: seg.filterCode,
        suspectCount: info.suspect,
        notes: [],
      })
    } else {
      const existing = merged[existingIndex]
      existing.actualCount += info.count
      existing.suspectCount += info.suspect
      existing.plannedCount = Math.max(existing.plannedCount, seg.plannedCount)
      if (existing.tempF === undefined) existing.tempF = temp
      mergedParts.get(existingIndex)?.push(info.count)
    }
  }

  merged.forEach((b, i) => {
    const parts = mergedParts.get(i) as number[]
    if (parts.length > 1) {
      b.notes.push(
        `Combined from ${parts.length} runs (${parts.join(' + ')} frames) - the earlier run(s) were stopped and restarted.`,
      )
    }
    if (b.suspectCount > 0) {
      b.notes.push(
        `${b.suspectCount} of these frame${b.suspectCount > 1 ? 's were' : ' was'} exposing while guiding lost its star, so may be trailed. They are still counted - lower # Frames if you discarded them.`,
      )
    }
  })

  // Calibration frames shot more than once for the same filter, at a
  // different auto-exposure each time, almost always means the first
  // attempt was redone - the log can't say which set survived.
  const calibrationGroups = new Map<string, number[]>()
  merged.forEach((b, i) => {
    if (b.frameType === 'light') return
    const key = `${b.frameType}|${b.binning}|${b.filterCode ?? ''}`
    calibrationGroups.set(key, [...(calibrationGroups.get(key) ?? []), i])
  })
  for (const indexes of calibrationGroups.values()) {
    if (indexes.length < 2) continue
    for (const i of indexes) {
      merged[i].notes.push(
        'This calibration set was shot more than once in this log at different exposures - probably a redo. Keep only the batch that matches the files you kept.',
      )
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
