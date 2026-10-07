import { putDoc, type CollectionName } from '../../firebase/firestoreDb'
import { sortFilters } from '../../lib/filters'
import type { FilterDef, Retirable } from '../../types/models'

export function byDescription<T extends { description: string }>(items: T[] | undefined): T[] | undefined {
  return items && [...items].sort((a, b) => a.description.localeCompare(b.description))
}

export function sortedFilters(items: FilterDef[] | undefined): FilterDef[] | undefined {
  return items && sortFilters(items)
}

export async function setRetired<T extends Retirable>(name: CollectionName, item: T, retired: boolean) {
  // putDoc replaces the whole document, and drops undefined fields, so
  // restoring just removes `retiredAt`.
  await putDoc(name, { ...item, retiredAt: retired ? new Date().toISOString() : undefined })
}

// Form inputs hold strings; these convert to and from the optional numbers
// stored on a document.
export function numToField(n: number | undefined): string {
  return n !== undefined ? String(n) : ''
}

export function fieldToNum(s: string): number | undefined {
  return s ? Number(s) : undefined
}
