import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { IconHome, IconMoon, IconSliders, IconTarget } from './icons'
import { useNightMode } from '../lib/useNightMode'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', Icon: IconHome, end: true },
  { to: '/projects', label: 'Projects', Icon: IconTarget, end: false },
  { to: '/settings', label: 'Settings', Icon: IconSliders, end: false },
]

export function Layout() {
  const [online, setOnline] = useState(navigator.onLine)
  const [nightMode, setNightMode] = useNightMode()

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Astro Project Tracker</h1>
        <button
          type="button"
          className="night-toggle"
          onClick={() => setNightMode((v) => !v)}
          aria-pressed={nightMode}
          aria-label="Toggle night mode"
        >
          <IconMoon />
        </button>
      </header>
      {!online && (
        <div className="offline-banner">
          Offline — changes are saved on this device and nothing is lost.
        </div>
      )}
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <span className="icon">
              <Icon />
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
