// Bare "YYYY-MM-DD" strings are calendar dates, not instants: parse them as
// local midnight so they display as the same day in every timezone (new Date
// would read them as UTC and show the previous day west of Greenwich). Full
// ISO timestamps (createdAt/updatedAt) are real instants and parse normally.
function parseDate(iso: string): Date {
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (bare) return new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3]))
  return new Date(iso)
}

export function formatDate(iso: string): string {
  return parseDate(iso).toLocaleDateString(undefined, {
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

// Whole calendar days between a session date and today, both taken in the
// local timezone and compared at UTC midnight so DST can't skew the count.
export function daysSince(dateIso: string): number {
  const then = parseDate(dateIso)
  const now = new Date()
  const utcThen = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())
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
// Uses the local date, not toISOString (UTC), which flips to tomorrow in the
// evening for anyone west of Greenwich.
export function today(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
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
