import { TARGET_CATALOG } from '../data/targetCatalog'
import { formatTarget } from './targetSearch'

// AstroBin titles read like "NGC 1333 - A Dusty Region in Taurus": the object
// first, then a tagline. The project's target field should hold only the
// object, and the project name the whole title.

export interface SplitTitle {
  target: string
  projectName?: string
}

// Catalog prefixes, longest first so "mel" is tried before "m".
const DESIGNATION =
  /^(messier|sharpless\s*2|sh\s*2|ngc|ic|lbn|ldn|vdb|barnard|abell|collinder|melotte|caldwell|arp|cr|mel|m|b)\s*-?\s*(\d+)(?![A-Za-z0-9])/i

const MORE_DESIGNATIONS = /^\s*(?:\/|\+|&|,|\band\b)\s*/i
const LEADING_SEPARATORS = /^[\s\-–—|:·,/]+/

const PREFIX_NAMES: Record<string, (n: string) => string> = {
  messier: (n) => `M${n}`,
  m: (n) => `M${n}`,
  ngc: (n) => `NGC ${n}`,
  ic: (n) => `IC ${n}`,
  sharpless2: (n) => `Sh2-${n}`,
  sh2: (n) => `Sh2-${n}`,
  lbn: (n) => `LBN ${n}`,
  ldn: (n) => `LDN ${n}`,
  vdb: (n) => `vdB ${n}`,
  barnard: (n) => `Barnard ${n}`,
  b: (n) => `Barnard ${n}`,
  abell: (n) => `Abell ${n}`,
  collinder: (n) => `Collinder ${n}`,
  cr: (n) => `Collinder ${n}`,
  melotte: (n) => `Melotte ${n}`,
  mel: (n) => `Melotte ${n}`,
  caldwell: (n) => `Caldwell ${n}`,
  arp: (n) => `Arp ${n}`,
}

// "NGC1333", "ngc 1333" and "NGC 1333" are all "NGC 1333".
function canonicalDesignation(prefix: string, number: string): string {
  const key = prefix.toLowerCase().replace(/\s+/g, '')
  return PREFIX_NAMES[key](String(Number(number)))
}

const compact = (text: string) => text.toLowerCase().replace(/\s+/g, '')

// The app's own wording for a known object ("M42 - Orion Nebula"), so imported
// targets read the same as ones picked from the autocomplete.
function catalogWording(designation: string): string | undefined {
  const entry = TARGET_CATALOG.find((t) => compact(t.id) === compact(designation))
  return entry && formatTarget(entry)
}

export function splitTitle(title: string): SplitTitle {
  const whole = title.trim()
  const designations: string[] = []
  let rest = whole

  for (let match = DESIGNATION.exec(rest); match; match = DESIGNATION.exec(rest)) {
    designations.push(canonicalDesignation(match[1], match[2]))
    rest = rest.slice(match[0].length)
    const join = MORE_DESIGNATIONS.exec(rest)
    if (!join || !DESIGNATION.test(rest.slice(join[0].length))) break
    rest = rest.slice(join[0].length)
  }

  // No catalog designation up front: leave the title alone rather than guess.
  if (designations.length === 0) return { target: whole }

  const objects = designations.join(' / ')
  const tagline = rest.replace(LEADING_SEPARATORS, '').trim()
  return {
    target: designations.length === 1 ? (catalogWording(designations[0]) ?? objects) : objects,
    projectName: tagline ? `${objects} - ${tagline}` : undefined,
  }
}
