// Filters list in a fixed order that matches how astrophotographers usually
// think about them (narrowband first, then broadband/LRGB), not alphabetical
// - alphabetical would put "B" before "Ha", which reads wrong to anyone used
// to this convention. Anything outside this list (e.g. "L-Extreme", "Dark")
// falls back to alphabetical after the known ones.
const FILTER_ORDER = ['S', 'Ha', 'OIII', 'L', 'R', 'G', 'B']

export function sortFilters<T extends { description: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const rankA = FILTER_ORDER.indexOf(a.description)
    const rankB = FILTER_ORDER.indexOf(b.description)
    const orderA = rankA === -1 ? FILTER_ORDER.length : rankA
    const orderB = rankB === -1 ? FILTER_ORDER.length : rankB
    if (orderA !== orderB) return orderA - orderB
    return a.description.localeCompare(b.description)
  })
}
