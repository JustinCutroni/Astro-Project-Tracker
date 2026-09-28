import { TARGET_CATALOG, type CatalogTarget } from '../data/targetCatalog'

export function formatTarget(t: CatalogTarget): string {
  return t.name ? `${t.id} - ${t.name}` : `${t.id} (${t.type})`
}

export function searchTargets(query: string, limit = 8): CatalogTarget[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const qCompact = q.replace(/\s+/g, '')

  const starts: CatalogTarget[] = []
  const contains: CatalogTarget[] = []

  for (const t of TARGET_CATALOG) {
    const idLower = t.id.toLowerCase()
    const idCompact = idLower.replace(/\s+/g, '')
    const nameLower = (t.name || '').toLowerCase()

    if (idLower.startsWith(q) || idCompact.startsWith(qCompact) || nameLower.startsWith(q)) {
      starts.push(t)
    } else if (idLower.includes(q) || nameLower.includes(q)) {
      contains.push(t)
    }
  }

  return [...starts, ...contains].slice(0, limit)
}
