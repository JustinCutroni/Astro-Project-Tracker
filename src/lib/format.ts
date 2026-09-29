export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

// Session dates are bare "YYYY-MM-DD" strings, which Date parses as UTC
// midnight - comparing against a UTC-midnight version of "today" (rather
// than the current instant) avoids the local clock's time-of-day nudging
// the count by a day in either direction.
export function daysSince(dateIso: string): number {
  const then = new Date(dateIso)
  const now = new Date()
  const utcThen = Date.UTC(then.getUTCFullYear(), then.getUTCMonth(), then.getUTCDate())
  const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((utcNow - utcThen) / 86400000)
}

// Goal hours is free text to match the source app ("20+", "~15", etc.) -
// this pulls a usable number off the front for progress math where
// possible, and gives up cleanly (undefined) where it isn't.
export function parseGoalHours(goalHours: string | undefined): number | undefined {
  if (!goalHours) return undefined
  const match = /^[\d.]+/.exec(goalHours.trim())
  if (!match) return undefined
  const value = parseFloat(match[0])
  return Number.isFinite(value) && value > 0 ? value : undefined
}

// Today's date as the same bare "YYYY-MM-DD" shape session dates use.
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// A short, human label for a session date relative to today - "Tonight"
// and "Tomorrow" read faster than a calendar date for the sessions someone
// actually needs to act on soon; anything further out just shows the date.
export function relativeDayLabel(dateIso: string): string {
  const daysUntil = -daysSince(dateIso)
  if (daysUntil === 0) return 'Tonight'
  if (daysUntil === 1) return 'Tomorrow'
  return formatDate(dateIso)
}
