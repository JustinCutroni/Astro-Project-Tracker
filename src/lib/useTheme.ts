import { useSyncExternalStore } from 'react'
import {
  LEGACY_NIGHT_STORAGE_KEY,
  parseStoredTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from './theme'

function readStored(): ThemePreference {
  try {
    return parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY), localStorage.getItem(LEGACY_NIGHT_STORAGE_KEY))
  } catch {
    return 'auto'
  }
}

// One shared value, so the header button and the Settings picker never disagree.
let current = readStored()
const listeners = new Set<() => void>()

// Only an explicit choice sets data-theme. With none, the CSS follows the device on its own.
// The browser toolbar color is read back from the page's own background so it always matches.
function applyToDocument() {
  const root = document.documentElement
  if (current === 'auto') delete root.dataset.theme
  else root.dataset.theme = current
  const background = getComputedStyle(root).getPropertyValue('--bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background)
}

applyToDocument()
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyToDocument)

function setTheme(next: ThemePreference) {
  current = next
  applyToDocument()
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // private browsing or storage disabled - the choice just won't persist
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current)
  return [theme, setTheme] as const
}
