import type { FrameType } from '../types/models'

// Reads a FITS file's ASCII header directly - the same metadata a filename
// only hints at (via a convention that can be ambiguous - e.g. ASIAIR's own
// "<n>F" filename suffix is actually Celsius, confirmed against real
// captures, despite the "F"). The header's CCD-TEMP keyword has no such
// ambiguity: it's Celsius by FITS convention, always. A FITS header is a
// sequence of 80-byte ASCII "cards" (KEYWORD = value / comment), padded to a
// multiple of 2880 bytes, ending at an "END" card - well within what's
// practical to parse by hand, with no imaging library needed.

const CARD_SIZE = 80
const MAX_CARDS = 900 // header is almost always <5 blocks (180 cards); this is a generous safety cap

export function parseFitsHeaderCards(buffer: ArrayBuffer): Map<string, string> {
  const bytes = new Uint8Array(buffer)
  const decoder = new TextDecoder('ascii')
  const values = new Map<string, string>()

  for (let i = 0; i < MAX_CARDS; i++) {
    const offset = i * CARD_SIZE
    if (offset + CARD_SIZE > bytes.length) break
    const card = decoder.decode(bytes.subarray(offset, offset + CARD_SIZE))
    const keyword = card.slice(0, 8).trim()
    if (keyword === 'END') break
    if (!keyword || card[8] !== '=') continue

    const rest = card.slice(10)
    const quoted = /^\s*'([^']*)'/.exec(rest)
    if (quoted) {
      values.set(keyword, quoted[1].trim())
      continue
    }
    const commentIndex = rest.indexOf('/')
    const raw = (commentIndex >= 0 ? rest.slice(0, commentIndex) : rest).trim()
    values.set(keyword, raw)
  }

  return values
}

export interface FitsFrameInfo {
  frameType?: FrameType
  target?: string
  exposureSeconds?: number
  binning?: string
  gain?: number
  tempF?: number
  filterName?: string
}

function mapImageType(raw: string): FrameType | undefined {
  const key = raw.toLowerCase()
  if (key.includes('flat') && key.includes('dark')) return 'flat-dark'
  if (key.includes('flat')) return 'flat'
  if (key.includes('dark')) return 'dark'
  if (key.includes('bias')) return 'bias'
  if (key.includes('light')) return 'light'
  return undefined
}

export function extractFitsFrameInfo(buffer: ArrayBuffer): FitsFrameInfo {
  const cards = parseFitsHeaderCards(buffer)
  const info: FitsFrameInfo = {}

  const imageType = cards.get('IMAGETYP')
  if (imageType) info.frameType = mapImageType(imageType)

  const object = cards.get('OBJECT')
  if (object) info.target = object

  const exposure = cards.get('EXPOSURE') ?? cards.get('EXPTIME')
  if (exposure !== undefined) {
    const value = parseFloat(exposure)
    if (Number.isFinite(value)) info.exposureSeconds = value
  }

  const binning = cards.get('XBINNING') ?? cards.get('BINNING')
  if (binning !== undefined) {
    const value = parseInt(binning, 10)
    if (Number.isFinite(value)) info.binning = `${value}x${value}`
  }

  const gain = cards.get('GAIN')
  if (gain !== undefined) {
    const value = parseInt(gain, 10)
    if (Number.isFinite(value)) info.gain = value
  }

  // CCD-TEMP is Celsius by FITS convention - convert to the °F this app
  // stores everywhere else.
  const tempC = cards.get('CCD-TEMP')
  if (tempC !== undefined) {
    const value = parseFloat(tempC)
    if (Number.isFinite(value)) info.tempF = (value * 9) / 5 + 32
  }

  const filter = cards.get('FILTER')
  if (filter) info.filterName = filter

  return info
}
