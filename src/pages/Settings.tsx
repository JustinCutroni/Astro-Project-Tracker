import { useState } from 'react'
import { putDoc, removeDoc, useCollection } from '../firebase/firestoreDb'
import { newId, nowIso } from '../lib/ids'
import { IconClose } from '../components/icons'
import { findCameraSpec, searchCameraCatalog, type CameraSpec } from '../data/cameraCatalog'
import type { Camera, FilterDef, Location, Mount, Telescope } from '../types/models'
import { signOutUser, useAuthUser } from '../firebase/auth'
import { sortFilters } from '../lib/filters'

function byDescription<T extends { description: string }>(items: T[] | undefined): T[] | undefined {
  return items && [...items].sort((a, b) => a.description.localeCompare(b.description))
}

function sortedFilters(items: FilterDef[] | undefined): FilterDef[] | undefined {
  return items && sortFilters(items)
}

type Tab = 'cameras' | 'telescopes' | 'mounts' | 'filters' | 'locations'

export function Settings() {
  const [tab, setTab] = useState<Tab>('cameras')
  const { user } = useAuthUser()

  return (
    <div>
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      {user && (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="muted">Signed in as {user.email}</span>
          <button className="btn btn-sm" onClick={() => signOutUser()}>
            Sign out
          </button>
        </div>
      )}

      <div className="tabs">
        <button className={tab === 'cameras' ? 'active' : ''} onClick={() => setTab('cameras')}>
          Cameras
        </button>
        <button
          className={tab === 'telescopes' ? 'active' : ''}
          onClick={() => setTab('telescopes')}
        >
          Telescopes
        </button>
        <button className={tab === 'mounts' ? 'active' : ''} onClick={() => setTab('mounts')}>
          Mounts
        </button>
        <button className={tab === 'filters' ? 'active' : ''} onClick={() => setTab('filters')}>
          Filters
        </button>
        <button className={tab === 'locations' ? 'active' : ''} onClick={() => setTab('locations')}>
          Locations
        </button>
      </div>
      {tab === 'cameras' && <CamerasTab />}
      {tab === 'telescopes' && <TelescopesTab />}
      {tab === 'mounts' && <MountsTab />}
      {tab === 'filters' && <FiltersTab />}
      {tab === 'locations' && <LocationsTab />}
    </div>
  )
}

function CamerasTab() {
  const cameras = byDescription(useCollection<Camera>('cameras'))
  const [description, setDescription] = useState('')
  const [cameraType, setCameraType] = useState('')
  const [sensorWidthMm, setSensorWidthMm] = useState('')
  const [sensorHeightMm, setSensorHeightMm] = useState('')
  const [pixelSizeUm, setPixelSizeUm] = useState('')
  const [resolutionWidthPx, setResolutionWidthPx] = useState('')
  const [resolutionHeightPx, setResolutionHeightPx] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestions = showSuggestions ? searchCameraCatalog(description) : []

  function applySpec(spec: CameraSpec) {
    setDescription(spec.model)
    setCameraType(spec.sensorType)
    setSensorWidthMm(String(spec.sensorWidthMm))
    setSensorHeightMm(String(spec.sensorHeightMm))
    setPixelSizeUm(String(spec.pixelSizeUm))
    setResolutionWidthPx(String(spec.resolutionWidthPx))
    setResolutionHeightPx(String(spec.resolutionHeightPx))
    setShowSuggestions(false)
  }

  function handleDescriptionBlur() {
    setTimeout(() => setShowSuggestions(false), 150)
    // If specs are still blank, see if the typed name matches a known model.
    if (!sensorWidthMm) {
      const spec = findCameraSpec(description)
      if (spec) applySpec(spec)
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<Camera>('cameras', {
      id: newId(),
      description: description.trim(),
      cameraType: cameraType.trim() || undefined,
      sensorWidthMm: sensorWidthMm ? Number(sensorWidthMm) : undefined,
      sensorHeightMm: sensorHeightMm ? Number(sensorHeightMm) : undefined,
      pixelSizeUm: pixelSizeUm ? Number(pixelSizeUm) : undefined,
      resolutionWidthPx: resolutionWidthPx ? Number(resolutionWidthPx) : undefined,
      resolutionHeightPx: resolutionHeightPx ? Number(resolutionHeightPx) : undefined,
      dateAdded: nowIso(),
    })
    setDescription('')
    setCameraType('')
    setSensorWidthMm('')
    setSensorHeightMm('')
    setPixelSizeUm('')
    setResolutionWidthPx('')
    setResolutionHeightPx('')
  }

  async function remove(id: string) {
    await removeDoc('cameras', id)
  }

  if (!cameras) return null

  return (
    <div>
      <div className="card">
        {cameras.length === 0 && <div className="muted">No cameras added yet.</div>}
        {cameras.map((c) => (
          <div className="list-item" key={c.id}>
            <span>
              {c.description} {c.cameraType && <span className="muted">({c.cameraType})</span>}
              {c.sensorWidthMm && c.pixelSizeUm && (
                <div className="muted" style={{ fontSize: '0.78rem' }}>
                  {c.sensorWidthMm} &times; {c.sensorHeightMm}mm &middot; {c.pixelSizeUm}
                  {'µ'}m pixels
                  {c.resolutionWidthPx && ` · ${c.resolutionWidthPx}×${c.resolutionHeightPx}`}
                </div>
              )}
            </span>
            <button className="icon-btn" onClick={() => remove(c.id)} aria-label="Remove">
              <IconClose />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={add}>
        <div className="form-row">
          <div className="form-field autocomplete-wrap">
            <label>Description</label>
            <input
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setSensorWidthMm('')
                setSensorHeightMm('')
                setPixelSizeUm('')
                setResolutionWidthPx('')
                setResolutionHeightPx('')
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={handleDescriptionBlur}
              autoComplete="off"
              placeholder="e.g. ZWO ASI2600MM Pro"
            />
            {suggestions.length > 0 && (
              <ul className="suggestion-list">
                {suggestions.map((s) => (
                  <li key={s.model}>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); applySpec(s) }}>
                      {s.model}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="form-field" style={{ flex: '0 0 7rem' }}>
            <label>Type</label>
            <input
              value={cameraType}
              onChange={(e) => setCameraType(e.target.value)}
              placeholder="e.g. Mono"
            />
          </div>
        </div>

        {(sensorWidthMm || sensorHeightMm || pixelSizeUm) && (
          <div className="form-row">
            <div className="form-field">
              <label>Sensor (mm)</label>
              <div className="form-row" style={{ gap: '0.4rem' }}>
                <input
                  value={sensorWidthMm}
                  onChange={(e) => setSensorWidthMm(e.target.value)}
                  placeholder="width"
                  type="number"
                  step="0.1"
                />
                <input
                  value={sensorHeightMm}
                  onChange={(e) => setSensorHeightMm(e.target.value)}
                  placeholder="height"
                  type="number"
                  step="0.1"
                />
              </div>
            </div>
            <div className="form-field" style={{ flex: '0 0 6rem' }}>
              <label>Pixel ({'µ'}m)</label>
              <input
                value={pixelSizeUm}
                onChange={(e) => setPixelSizeUm(e.target.value)}
                type="number"
                step="0.01"
              />
            </div>
            <div className="form-field">
              <label>Resolution (px)</label>
              <div className="form-row" style={{ gap: '0.4rem' }}>
                <input
                  value={resolutionWidthPx}
                  onChange={(e) => setResolutionWidthPx(e.target.value)}
                  placeholder="width"
                  type="number"
                />
                <input
                  value={resolutionHeightPx}
                  onChange={(e) => setResolutionHeightPx(e.target.value)}
                  placeholder="height"
                  type="number"
                />
              </div>
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>
    </div>
  )
}

function TelescopesTab() {
  const telescopes = byDescription(useCollection<Telescope>('telescopes'))
  const [description, setDescription] = useState('')
  const [focalLength, setFocalLength] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<Telescope>('telescopes', {
      id: newId(),
      description: description.trim(),
      focalLength: focalLength.trim() || undefined,
      dateAdded: nowIso(),
    })
    setDescription('')
    setFocalLength('')
  }

  async function remove(id: string) {
    await removeDoc('telescopes', id)
  }

  if (!telescopes) return null

  return (
    <div>
      <div className="card">
        {telescopes.length === 0 && <div className="muted">No telescopes added yet.</div>}
        {telescopes.map((t) => (
          <div className="list-item" key={t.id}>
            <span>
              {t.description} {t.focalLength && <span className="muted">({t.focalLength}mm)</span>}
            </span>
            <button className="icon-btn" onClick={() => remove(t.id)} aria-label="Remove">
              <IconClose />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="form-row" style={{ alignItems: 'flex-end' }}>
        <div className="form-field">
          <label>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 8in RC Telescope"
          />
        </div>
        <div className="form-field" style={{ flex: '0 0 7rem' }}>
          <label>Focal length</label>
          <input
            value={focalLength}
            onChange={(e) => setFocalLength(e.target.value)}
            placeholder="1600"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>
    </div>
  )
}

function MountsTab() {
  const mounts = byDescription(useCollection<Mount>('mounts'))
  const [description, setDescription] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<Mount>('mounts', { id: newId(), description: description.trim(), dateAdded: nowIso() })
    setDescription('')
  }

  async function remove(id: string) {
    await removeDoc('mounts', id)
  }

  if (!mounts) return null

  return (
    <div>
      <div className="card">
        {mounts.length === 0 && <div className="muted">No mounts added yet.</div>}
        {mounts.map((m) => (
          <div className="list-item" key={m.id}>
            <span>{m.description}</span>
            <button className="icon-btn" onClick={() => remove(m.id)} aria-label="Remove">
              <IconClose />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="form-row" style={{ alignItems: 'flex-end' }}>
        <div className="form-field">
          <label>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. EQ6-R Pro"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>
    </div>
  )
}

function FiltersTab() {
  const filters = sortedFilters(useCollection<FilterDef>('filters'))
  const [description, setDescription] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<FilterDef>('filters', { id: newId(), description: description.trim(), dateAdded: nowIso() })
    setDescription('')
  }

  async function remove(id: string) {
    await removeDoc('filters', id)
  }

  if (!filters) return null

  return (
    <div>
      <div className="card">
        {filters.length === 0 && <div className="muted">No filters added yet.</div>}
        {filters.map((f) => (
          <div className="list-item" key={f.id}>
            <span>{f.description}</span>
            <button className="icon-btn" onClick={() => remove(f.id)} aria-label="Remove">
              <IconClose />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="form-row" style={{ alignItems: 'flex-end' }}>
        <div className="form-field">
          <label>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Ha"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>
    </div>
  )
}

function LocationsTab() {
  const locations = byDescription(useCollection<Location>('locations'))
  const [description, setDescription] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<Location>('locations', { id: newId(), description: description.trim(), dateAdded: nowIso() })
    setDescription('')
  }

  async function remove(id: string) {
    await removeDoc('locations', id)
  }

  if (!locations) return null

  return (
    <div>
      <div className="card">
        {locations.length === 0 && <div className="muted">No locations added yet.</div>}
        {locations.map((l) => (
          <div className="list-item" key={l.id}>
            <span>{l.description}</span>
            <button className="icon-btn" onClick={() => remove(l.id)} aria-label="Remove">
              <IconClose />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="form-row" style={{ alignItems: 'flex-end' }}>
        <div className="form-field">
          <label>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Remote Observatory - Utah"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>
    </div>
  )
}
