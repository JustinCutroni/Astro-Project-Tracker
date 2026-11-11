import { NavLink, Outlet, useMatch } from 'react-router-dom'
import { IconDome, IconHome, IconMoon, IconSliders, IconTarget } from './icons'
import { useTheme } from '../lib/useTheme'
import { useOnline } from '../lib/useOnline'
import { useGoBack } from '../lib/useGoBack'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', Icon: IconHome, end: true },
  { to: '/projects', label: 'Projects', Icon: IconTarget, end: false },
  { to: '/settings', label: 'Settings', Icon: IconSliders, end: false },
]

export function Layout() {
  const online = useOnline()
  const [theme, setTheme] = useTheme()
  const nightMode = theme === 'night'
  // The Starfront page fills the screen: no header or offline banner, just the bottom menu.
  const starfrontOpen = useMatch('/starfront') !== null
  const closeStarfront = useGoBack('/')

  return (
    <div className="app-shell">
      {!starfrontOpen && (
        <header className="app-header">
          <h1>Astro Project Tracker</h1>
          <button
            type="button"
            className="night-toggle"
            onClick={() => setTheme(nightMode ? 'auto' : 'night')}
            aria-pressed={nightMode}
            aria-label="Toggle night mode"
          >
            <IconMoon />
          </button>
        </header>
      )}
      {!online && !starfrontOpen && (
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
        {/* Works as a toggle: tapping it while open closes it and returns to the previous screen. */}
        <NavLink
          to="/starfront"
          className={starfrontOpen ? 'active' : undefined}
          aria-label="Starfront Status"
          title="Starfront Status"
          onClick={(event) => {
            if (!starfrontOpen) return
            event.preventDefault()
            closeStarfront()
          }}
        >
          <span className="icon">
            <IconDome />
          </span>
          <span>Starfront</span>
        </NavLink>
      </nav>
    </div>
  )
}
