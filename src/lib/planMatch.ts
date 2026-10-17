import type { FilterDef } from '../types/models'

// Filter names in a plan come from an AI or a website, so they rarely match
// the catalog letter for letter ("Lum / Clear", "Hα"). This finds the catalog
// filter a name most likely means; anything uncertain is left for the user.

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/α/g, 'a')
    .replace(/[^a-z0-9]/g, '')
}

// Other spellings of the usual filters, by normalized name.
const FILTER_ALIASES: Record<string, string> = {
  lum: 'l',
  luminance: 'l',
  clear: 'l',
  lumclear: 'l',
  red: 'r',
  green: 'g',
  blue: 'b',
  halpha: 'ha',
  o3: 'oiii',
  sii: 's',
  s2: 's',
}

// Filters match by exact name (after the aliases above) only: "L" must never
// match "L-Enhance". Retired filters are never offered.
export function matchFilter(name: string, filters: FilterDef[]): FilterDef | undefined {
  const active = filters.filter((f) => !f.retiredAt)
  const key = normalizeName(name)
  return (
    active.find((f) => normalizeName(f.description) === key) ??
    active.find((f) => normalizeName(f.description) === FILTER_ALIASES[key])
  )
}
