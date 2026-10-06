import { useCollection } from '../firebase/firestoreDb'
import type { Location, Session } from '../types/models'

// Location is free text on sessions (matching the source schema),
// not a foreign key - so suggestions come from whatever's been typed before,
// plus anything explicitly added in Settings for locations not used yet.
export function useKnownLocations(): string[] {
  const sessions = useCollection<Session>('sessions')
  const locations = useCollection<Location>('locations')

  const set = new Set<string>()
  for (const s of sessions || []) if (s.location) set.add(s.location)
  for (const l of locations || []) set.add(l.description)
  return [...set].sort()
}
