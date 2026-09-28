import { useCollection } from '../firebase/firestoreDb'
import type { Project, Session } from '../types/models'

// Location is free text (matching the source schema), so instead of a
// separate lookup table we just suggest whatever's been typed before.
export function useKnownLocations(): string[] {
  const projects = useCollection<Project>('projects')
  const sessions = useCollection<Session>('sessions')

  const set = new Set<string>()
  for (const p of projects || []) if (p.location) set.add(p.location)
  for (const s of sessions || []) if (s.location) set.add(s.location)
  return [...set].sort()
}
