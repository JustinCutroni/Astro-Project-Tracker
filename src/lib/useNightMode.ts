import { useEffect, useState } from 'react'

const STORAGE_KEY = 'astro-night-mode'

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function useNightMode() {
  const [enabled, setEnabled] = useState(readStored)

  useEffect(() => {
    document.documentElement.dataset.theme = enabled ? 'night' : ''
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
    } catch {
      // private browsing or storage disabled - night mode just won't persist
    }
  }, [enabled])

  return [enabled, setEnabled] as const
}
