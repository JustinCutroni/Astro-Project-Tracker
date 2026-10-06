import type { FilterDef, Session } from '../types/models'

// Form state keeps positions as strings so a half-typed value doesn't fight
// the input; they're parsed to slot numbers only on save.
export type PositionInputs = Record<string, string>

export function inputsFromPositions(positions: Session['filterPositions']): PositionInputs {
  return Object.fromEntries(Object.entries(positions ?? {}).map(([id, n]) => [id, String(n)]))
}

export function positionsFromInputs(inputs: PositionInputs): Session['filterPositions'] {
  const entries = Object.entries(inputs)
    .map(([id, v]): [string, number] => [id, Math.floor(Number(v))])
    .filter(([, n]) => Number.isFinite(n) && n >= 1)
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

// The wheel is usually left as it was, so a new session starts from the most
// recent one that recorded positions.
export function latestPositions(sessions: Session[]): Session['filterPositions'] {
  return [...sessions]
    .filter((s) => s.filterPositions)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]?.filterPositions
}

// "1 Ha · 2 OIII", in wheel order.
export function describePositions(positions: Session['filterPositions'], filters: FilterDef[]): string[] {
  return Object.entries(positions ?? {})
    .sort((a, b) => a[1] - b[1])
    .map(([id, n]) => `${n} ${filters.find((f) => f.id === id)?.description ?? 'Unknown'}`)
}
