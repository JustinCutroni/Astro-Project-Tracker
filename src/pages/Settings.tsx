import { useState } from 'react'
import { signOutUser, useAuthUser } from '../firebase/auth'
import { CamerasTab } from './settings/CamerasTab'
import { TelescopesTab } from './settings/TelescopesTab'
import { MountsTab } from './settings/MountsTab'
import { FiltersTab } from './settings/FiltersTab'
import { LocationsTab } from './settings/LocationsTab'

const TABS = [
  { id: 'cameras', label: 'Cameras' },
  { id: 'telescopes', label: 'Telescopes' },
  { id: 'mounts', label: 'Mounts' },
  { id: 'filters', label: 'Filters' },
  { id: 'locations', label: 'Locations' },
] as const

type Tab = (typeof TABS)[number]['id']

export function Settings() {
  const [tab, setTab] = useState<Tab>('cameras')
  const { user } = useAuthUser()

  return (
    <div>
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      {user && (
        <div className="card settings-account">
          <span className="muted">Signed in as {user.email}</span>
          <button className="btn btn-sm" onClick={() => signOutUser()}>
            Sign out
          </button>
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'cameras' && <CamerasTab />}
      {tab === 'telescopes' && <TelescopesTab />}
      {tab === 'mounts' && <MountsTab />}
      {tab === 'filters' && <FiltersTab />}
      {tab === 'locations' && <LocationsTab />}
    </div>
  )
}
