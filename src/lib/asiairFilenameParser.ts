import type { FrameType } from '../types/models'

// Parses ASIAIR's FITS filename convention, e.g.:
//   Light_NGC 7000_180.0s_Bin1_2600MM_H_gain100_20260821-232712_252deg_-0.6F_0001.fit
//
// Unlike the Autorun log, a filename carries the filter, gain, and camera
// temperature for that specific frame - exactly the fields the log can't
// recover. Fields are identified by their own shape (a token ending in "s"/
// "ms" is the exposure, "BinN" is binning, etc.) rather than by position,
// since calibration frames (Dark/Flat/Bias) often omit the target and/or
// filter tokens that a Light frame has.

export interface ParsedAsiairFilename {
  frameType?: FrameType
  target?: string
  exposureSeconds?: number
  binning?: string
  cameraModel?: string
  filterCode?: string
  gain?: number
  capturedAt?: string // YYYY-MM-DDTHH:MM:SS
  angleDeg?: number
  tempF?: number
  frameNumber?: number
}

const FRAME_TYPE_BY_TOKEN: Record<string, FrameType> = {
  light: 'light',
  dark: 'dark',
  flat: 'flat',
  flatdark: 'flat-dark',
  bias: 'bias',
}

// Common single-letter/short ASIAIR filter codes, mapped to the names this
// app's filter catalog tends to use - a starting point for matching against
// a project's own filters, not an exhaustive list.
export const FILTER_CODE_ALIASES: Record<string, string[]> = {
  h: ['ha', 'h-alpha', 'hydrogen-alpha'],
  o: ['oiii', 'o3'],
  s: ['sii', 's2'],
  l: ['l', 'lum', 'luminance'],
  r: ['r', 'red'],
  g: ['g', 'green'],
  b: ['b', 'blue'],
}

const EXPOSURE_TOKEN_RE = /^([\d.]+)(ms|s)$/i
const BINNING_TOKEN_RE = /^Bin(\d+)$/i
const GAIN_TOKEN_RE = /^gain(\d+)$/i
const TIMESTAMP_TOKEN_RE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/
const ANGLE_TOKEN_RE = /^([\d.]+)deg$/i
const TEMP_TOKEN_RE = /^(-?[\d.]+)(F|C)$/i
const FRAME_NUMBER_RE = /^\d+$/

export function parseAsiairFilename(filename: string): ParsedAsiairFilename {
  const base = filename.trim().replace(/\.(fit|fits)$/i, '')
  const tokens = base.split('_').filter((t) => t.length > 0)
  const result: ParsedAsiairFilename = {}

  let startIndex = 0
  const frameTypeKey = tokens[0]?.toLowerCase().replace(/[^a-z]/g, '')
  if (frameTypeKey && FRAME_TYPE_BY_TOKEN[frameTypeKey]) {
    result.frameType = FRAME_TYPE_BY_TOKEN[frameTypeKey]
    startIndex = 1
  }

  let sawStructuredToken = false

  for (let i = startIndex; i < tokens.length; i++) {
    const token = tokens[i]

    if (i === tokens.length - 1 && FRAME_NUMBER_RE.test(token)) {
      result.frameNumber = parseInt(token, 10)
      continue
    }

    const exposureMatch = EXPOSURE_TOKEN_RE.exec(token)
    if (exposureMatch) {
      const [, value, unit] = exposureMatch
      const seconds = unit.toLowerCase() === 'ms' ? parseFloat(value) / 1000 : parseFloat(value)
      result.exposureSeconds = Math.round(seconds * 10000) / 10000
      sawStructuredToken = true
      continue
    }

    const binningMatch = BINNING_TOKEN_RE.exec(token)
    if (binningMatch) {
      result.binning = `${binningMatch[1]}x${binningMatch[1]}`
      sawStructuredToken = true
      continue
    }

    const gainMatch = GAIN_TOKEN_RE.exec(token)
    if (gainMatch) {
      result.gain = parseInt(gainMatch[1], 10)
      sawStructuredToken = true
      continue
    }

    const timestampMatch = TIMESTAMP_TOKEN_RE.exec(token)
    if (timestampMatch) {
      const [, year, month, day, hour, minute, second] = timestampMatch
      result.capturedAt = `${year}-${month}-${day}T${hour}:${minute}:${second}`
      sawStructuredToken = true
      continue
    }

    const angleMatch = ANGLE_TOKEN_RE.exec(token)
    if (angleMatch) {
      result.angleDeg = parseFloat(angleMatch[1])
      sawStructuredToken = true
      continue
    }

    const tempMatch = TEMP_TOKEN_RE.exec(token)
    if (tempMatch) {
      const [, value, unit] = tempMatch
      const raw = parseFloat(value)
      result.tempF = unit.toUpperCase() === 'C' ? (raw * 9) / 5 + 32 : raw
      sawStructuredToken = true
      continue
    }

    if (!sawStructuredToken) {
      // Before the first recognized field, an unmatched token is the target
      // name (may contain spaces, but not underscores, so it's one token).
      result.target = result.target ? `${result.target} ${token}` : token
      continue
    }

    // Between Bin and the gain/timestamp block, unmatched tokens are the
    // camera model, then the filter code, in that order.
    if (result.cameraModel === undefined) {
      result.cameraModel = token
    } else if (result.filterCode === undefined) {
      result.filterCode = token
    }
  }

  return result
}

// Finds a filter in the project's own list whose description matches a
// parsed filter code, directly ("Ha") or via the common-alias table ("H").
export function matchFilterCode(
  code: string,
  filters: { id: string; description: string }[],
): string | undefined {
  const key = code.toLowerCase()
  const candidates = new Set([key, ...(FILTER_CODE_ALIASES[key] || [])])
  const match = filters.find((f) => candidates.has(f.description.toLowerCase()))
  return match?.id
}
