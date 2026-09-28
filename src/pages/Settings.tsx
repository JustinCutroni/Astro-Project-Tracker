import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso } from '../db/db'
import { IconClose } from '../components/icons'
import { findCameraSpec, searchCameraCatalog, type CameraSpec } from '../data/cameraCatalog'

type Tab = 'cameras' | 'telescopes' | 'mounts' | 'filters'

export function Settings() {
  const [tab, setTab] = useState<Tab>('cameras')

  return (
    <div>
      <div className="page-header">
        <h2>Settings</h2>
      </div>
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
      </div>
      {tab === 'cameras' && <CamerasTab />}
      {tab === 'telescopes' && <TelescopesTab />}
      {tab === 'mounts' && <MountsTab />}
      {tab === 'filters' && <FiltersTab />}
    </div>
  )
}

function CamerasTab() {
  const cameras = useLiveQuery(() => db.cameras.orderBy('description').toArray(), [])
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
    await db.cameras.add({
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
    await db.cameras.delete(id)
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
  const telescopes = useLiveQuery(() => db.telescopes.orderBy('description').toArray(), [])
  const [description, setDescription] = useState('')
  const [focalLength, setFocalLength] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await db.telescopes.add({
      id: newId(),
      description: description.trim(),
      focalLength: focalLength.trim() || undefined,
      dateAdded: nowIso(),
    })
    setDescription('')
    setFocalLength('')
  }

  async function remove(id: string) {
    await db.telescopes.delete(id)
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
  const mounts = useLiveQuery(() => db.mounts.orderBy('description').toArray(), [])
  const [description, setDescription] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await db.mounts.add({ id: newId(), description: description.trim(), dateAdded: nowIso() })
    setDescription('')
  }

  async function remove(id: string) {
    await db.mounts.delete(id)
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
  const filters = useLiveQuery(() => db.filters.orderBy('description').toArray(), [])
  const [description, setDescription] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await db.filters.add({ id: newId(), description: description.trim(), dateAdded: nowIso() })
    setDescription('')
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
