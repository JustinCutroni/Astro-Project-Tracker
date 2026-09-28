import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '✨', end: true },
  { to: '/projects', label: 'Projects', icon: '\u{1F52D}', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', end: false },
]

export function Layout() {
  const [online, setOnline] = useState(navigator.onLine)

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
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
