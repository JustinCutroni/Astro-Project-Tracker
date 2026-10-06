// Filters are ordered by their filter wheel position (1-based) when they have
// one. Filters without a position come after the positioned ones, in a fixed
// order that matches how astrophotographers usually think about them
// (narrowband first, then broadband/LRGB), not alphabetical - alphabetical
// would put "B" before "Ha", which reads wrong to anyone used to this
// convention. Anything outside that list (e.g. "L-Extreme", "Dark") falls back
// to alphabetical after the known ones.
const FILTER_ORDER = ['S', 'Ha', 'OIII', 'L', 'R', 'G', 'B']

export function sortFilters<T extends { description: string; position?: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const hasPosA = a.position !== undefined
    const hasPosB = b.position !== undefined
    if (hasPosA && hasPosB && a.position !== b.position) return a.position! - b.position!
    if (hasPosA !== hasPosB) return hasPosA ? -1 : 1

    const rankA = FILTER_ORDER.indexOf(a.description)
    const rankB = FILTER_ORDER.indexOf(b.description)
    const orderA = rankA === -1 ? FILTER_ORDER.length : rankA
    const orderB = rankB === -1 ? FILTER_ORDER.length : rankB
    if (orderA !== orderB) return orderA - orderB
    return a.description.localeCompare(b.description)
  })
}
