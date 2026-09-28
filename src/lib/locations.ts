import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

// Location is free text (matching the source schema), so instead of a
// separate lookup table we just suggest whatever's been typed before.
export function useKnownLocations(): string[] {
  return (
    useLiveQuery(async () => {
      const [projects, sessions] = await Promise.all([
        db.projects.toArray(),
        db.sessions.toArray(),
      ])
      const set = new Set<string>()
      for (const p of projects) if (p.location) set.add(p.location)
      for (const s of sessions) if (s.location) set.add(s.location)
      return [...set].sort()
    }, []) ?? []
  )
}
