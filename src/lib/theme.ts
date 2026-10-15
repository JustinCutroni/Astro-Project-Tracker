export const THEME_CHOICES = [
  { id: 'auto', label: 'Auto', hint: 'Follows your device: Light by day, Dark at night' },
  { id: 'light', label: 'Light', hint: 'Bright, for daytime planning' },
  { id: 'dark', label: 'Dark', hint: 'Easy on the eyes indoors' },
  { id: 'night', label: 'Night', hint: 'Red on black, to keep your night vision at the eyepiece' },
] as const

export type ThemePreference = (typeof THEME_CHOICES)[number]['id']

export const THEME_STORAGE_KEY = 'astro-theme'
// Before themes had a picker, the header button saved '1' under this key for night mode.
export const LEGACY_NIGHT_STORAGE_KEY = 'astro-night-mode'

function isThemePreference(value: string | null): value is ThemePreference {
  return THEME_CHOICES.some((choice) => choice.id === value)
}

// Anything missing or unrecognised falls back to 'auto', so a bad stored value can never lock the app into an odd theme.
export function parseStoredTheme(stored: string | null, legacyNight: string | null): ThemePreference {
  if (isThemePreference(stored)) return stored
  if (legacyNight === '1') return 'night'
  return 'auto'
}
