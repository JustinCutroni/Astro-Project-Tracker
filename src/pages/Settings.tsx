import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../db/db'
import type { Equipment } from '../types/models'

type Tab = 'equipment' | 'filters' | 'locations'

export function Settings() {
  const [tab, setTab] = useState<Tab>('equipment')

  return (
    <div>
      <div className="page-header">
        <h2>Settings</h2>
      </div>
      <div className="tabs">
        <button className={tab === 'equipment' ? 'active' : ''} onClick={() => setTab('equipment')}>
          Equipment
        </button>
        <button className={tab === 'filters' ? 'active' : ''} onClick={() => setTab('filters')}>
          Filters
        </button>
        <button className={tab === 'locations' ? 'active' : ''} onClick={() => setTab('locations')}>
          Locations
        </button>
      </div>
      {tab === 'equipment' && <EquipmentTab />}
      {tab === 'filters' && <FiltersTab />}
      {tab === 'locations' && <LocationsTab />}
    </div>
  )
}

function EquipmentTab() {
  const equipment = useLiveQuery(() => db.equipment.orderBy('name').toArray(), [])
  const [name, setName] = useState('')
  const [type, setType] = useState<Equipment['type']>('telescope')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await db.equipment.add({ id: newId(), name: name.trim(), type })
    setName('')
  }

  async function remove(id: string) {
    await db.equipment.delete(id)
  }

  if (!equipment) return null

  return (
    <div>
      <div className="card">
        {equipment.length === 0 && <div className="muted">No equipment added yet.</div>}
        {equipment.map((eq) => (
          <div className="list-item" key={eq.id}>
            <span>
              {eq.name} <span className="muted">({eq.type})</span>
            </span>
            <button className="icon-btn" onClick={() => remove(eq.id)} aria-label="Remove">
              &#x2715;
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="form-row" style={{ alignItems: 'flex-end' }}>
        <div className="form-field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 8in RC Telescope" />
        </div>
        <div className="form-field" style={{ flex: '0 0 9rem' }}>
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as Equipment['type'])}>
            <option value="telescope">Telescope</option>
            <option value="camera">Camera</option>
            <option value="mount">Mount</option>
            <option value="filter-wheel">Filter wheel</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>
    </div>
  )
}

function FiltersTab() {
  const filters = useLiveQuery(() => db.filters.orderBy('name').toArray(), [])
  const [name, setName] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await db.filters.add({ id: newId(), name: name.trim() })
    setName('')
  }

  async function remove(id: string) {
    await db.filters.delete(id)
  }

  if (!filters) return null

  return (
    <div>
      <div className="card">
        {filters.length === 0 && <div className="muted">No filters added yet.</div>}
        {filters.map((f) => (
          <div className="list-item" key={f.id}>
            <span>{f.name}</span>
            <button className="icon-btn" onClick={() => remove(f.id)} aria-label="Remove">
              &#x2715;
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="form-row" style={{ alignItems: 'flex-end' }}>
        <div className="form-field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ha" />
        </div>
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>
    </div>
  )
}

function LocationsTab() {
  const locations = useLiveQuery(() => db.locations.orderBy('name').toArray(), [])
  const [name, setName] = useState('')
  const [isRemote, setIsRemote] = useState(false)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await db.locations.add({ id: newId(), name: name.trim(), isRemote })
    setName('')
    setIsRemote(false)
  }

  async function remove(id: string) {
    await db.locations.delete(id)
  }

  if (!locations) return null

  return (
    <div>
      <div className="card">
        {locations.length === 0 && <div className="muted">No locations added yet.</div>}
        {locations.map((loc) => (
          <div className="list-item" key={loc.id}>
            <span>
              {loc.name} {loc.isRemote && <span className="muted">(remote)</span>}
            </span>
            <button className="icon-btn" onClick={() => remove(loc.id)} aria-label="Remove">
              &#x2715;
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="form-row" style={{ alignItems: 'flex-end' }}>
        <div className="form-field">
          <label>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Remote Observatory - Utah"
          />
        </div>
        <label className="form-field" style={{ flex: '0 0 6rem', flexDirection: 'row', alignItems: 'center', gap: '0.4rem' }}>
          <input type="checkbox" checked={isRemote} onChange={(e) => setIsRemote(e.target.checked)} />
          Remote
        </label>
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>
    </div>
  )
}
