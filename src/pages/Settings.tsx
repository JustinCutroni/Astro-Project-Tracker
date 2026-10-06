import { useState } from 'react'
import { putDoc, removeDoc, useCollection, type CollectionName } from '../firebase/firestoreDb'
import { newId, nowIso } from '../lib/ids'
import { IconArchive, IconClose, IconEdit, IconRestore } from '../components/icons'
import { findCameraSpec, searchCameraCatalog, type CameraSpec } from '../data/cameraCatalog'
import { findTelescopeSpec, searchTelescopeCatalog, type TelescopeSpec } from '../data/telescopeCatalog'
import { searchMountCatalog } from '../data/mountCatalog'
import type { Camera, FilterDef, Location, Mount, Retirable, Telescope } from '../types/models'
import { signOutUser, useAuthUser } from '../firebase/auth'
import { sortFilters } from '../lib/filters'
import { useGearUsage } from '../lib/gear'
import { formatDate } from '../lib/format'

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

// Shared by every tab: the add form doubles as the edit form. Clicking the
// pencil loads an item into the form; saving overwrites it in place.
function FormActions({ editing, onCancel }: { editing: boolean; onCancel: () => void }) {
  return (
    <>
      <button type="submit" className="btn btn-primary">
        {editing ? 'Save' : 'Add'}
      </button>
      {editing && (
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      )}
    </>
  )
}

// Locations are plain free-text suggestions, so they keep the simple
// edit/remove pair.
function RowButtons({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  return (
    <span style={{ display: 'flex', gap: '0.25rem' }}>
      <button className="icon-btn" onClick={onEdit} aria-label="Edit">
        <IconEdit />
      </button>
      <button className="icon-btn" onClick={onRemove} aria-label="Remove">
        <IconClose />
      </button>
    </span>
  )
}

async function setRetired<T extends Retirable>(name: CollectionName, item: T, retired: boolean) {
  // putDoc replaces the whole document, and drops undefined fields, so
  // restoring just removes `retiredAt`.
  await putDoc(name, { ...item, retiredAt: retired ? new Date().toISOString() : undefined })
}

// The list card shared by the gear tabs (cameras, telescopes, mounts,
// filters). Gear that anything refers to can only be retired - hidden from
// pickers but kept so history still resolves - and is deletable only while
// nothing uses it. Retired gear is tucked behind a toggle and can be restored.
function CatalogList<T extends Retirable>({
  name,
  items,
  usage,
  emptyText,
  renderItem,
  onEdit,
}: {
  name: CollectionName
  items: T[]
  usage: Map<string, number> | undefined
  emptyText: string
  renderItem: (item: T) => React.ReactNode
  onEdit: (item: T) => void
}) {
  const [showRetired, setShowRetired] = useState(false)
  const active = items.filter((i) => !i.retiredAt)
  const retired = items.filter((i) => i.retiredAt)
  const visible = showRetired ? [...active, ...retired] : active

  return (
    <div className="card">
      {items.length === 0 && <div className="muted">{emptyText}</div>}
      {items.length > 0 && visible.length === 0 && (
        <div className="muted">Everything here is retired.</div>
      )}
      {visible.map((item) => {
        const isRetired = Boolean(item.retiredAt)
        // Unknown usage (still loading) is treated as "in use" - never offer a
        // delete we can't yet vouch for.
        const canDelete = usage !== undefined && !usage.get(item.id)
        return (
          <div className="list-item" key={item.id} style={isRetired ? { opacity: 0.6 } : undefined}>
            <span>
              {renderItem(item)}
              {isRetired && <span className="muted"> · retired {formatDate(item.retiredAt!)}</span>}
            </span>
            <span style={{ display: 'flex', gap: '0.25rem' }}>
              <button className="icon-btn" onClick={() => onEdit(item)} aria-label="Edit">
                <IconEdit />
              </button>
              <button
                className="icon-btn"
                onClick={() => setRetired(name, item, !isRetired)}
                aria-label={isRetired ? 'Restore' : 'Retire'}
                title={
                  isRetired
                    ? 'Restore - offer it in pickers again'
                    : 'Retire - hide it from pickers but keep it in your history'
                }
              >
                {isRetired ? <IconRestore /> : <IconArchive />}
              </button>
              {canDelete && (
                <button
                  className="icon-btn"
                  onClick={() => removeDoc(name, item.id)}
                  aria-label="Delete"
                  title="Delete - nothing uses this"
                >
                  <IconClose />
                </button>
              )}
            </span>
          </div>
        )
      })}
      {retired.length > 0 && (
        <div className="list-item">
          <button type="button" className="btn btn-sm" onClick={() => setShowRetired((v) => !v)}>
            {showRetired ? 'Hide' : 'Show'} retired ({retired.length})
          </button>
        </div>
      )}
      {items.length > 0 && (
        <div className="muted" style={{ fontSize: '0.78rem', paddingTop: '0.5rem' }}>
          Retire gear you no longer use or have sold. Anything used in a session or frame
          can only be retired, so your history stays intact.
        </div>
      )}
    </div>
  )
}

function Suggestions({ items, onPick }: { items: string[]; onPick: (i: number) => void }) {
  if (items.length === 0) return null
  return (
    <ul className="suggestion-list">
      {items.map((label, i) => (
        <li key={label}>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); onPick(i) }}>
            {label}
          </button>
        </li>
      ))}
    </ul>
  )
}

function CamerasTab() {
  const cameras = byDescription(useCollection<Camera>('cameras'))
  const usage = useGearUsage()
  const [editing, setEditing] = useState<Camera | null>(null)
  const [description, setDescription] = useState('')
  const [cameraType, setCameraType] = useState('')
  const [sensorWidthMm, setSensorWidthMm] = useState('')
  const [sensorHeightMm, setSensorHeightMm] = useState('')
  const [pixelSizeUm, setPixelSizeUm] = useState('')
  const [resolutionWidthPx, setResolutionWidthPx] = useState('')
  const [resolutionHeightPx, setResolutionHeightPx] = useState('')
  const [defaultGain, setDefaultGain] = useState('')
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
    setDefaultGain(spec.defaultGain !== undefined ? String(spec.defaultGain) : '')
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

  function reset() {
    setEditing(null)
    setDescription('')
    setCameraType('')
    setSensorWidthMm('')
    setSensorHeightMm('')
    setPixelSizeUm('')
    setResolutionWidthPx('')
    setResolutionHeightPx('')
    setDefaultGain('')
  }

  function startEdit(c: Camera) {
    setEditing(c)
    setDescription(c.description)
    setCameraType(c.cameraType ?? '')
    setSensorWidthMm(c.sensorWidthMm !== undefined ? String(c.sensorWidthMm) : '')
    setSensorHeightMm(c.sensorHeightMm !== undefined ? String(c.sensorHeightMm) : '')
    setPixelSizeUm(c.pixelSizeUm !== undefined ? String(c.pixelSizeUm) : '')
    setResolutionWidthPx(c.resolutionWidthPx !== undefined ? String(c.resolutionWidthPx) : '')
    setResolutionHeightPx(c.resolutionHeightPx !== undefined ? String(c.resolutionHeightPx) : '')
    setDefaultGain(c.defaultGain !== undefined ? String(c.defaultGain) : '')
    setShowSuggestions(false)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<Camera>('cameras', {
      ...editing,
      id: editing?.id ?? newId(),
      description: description.trim(),
      cameraType: cameraType.trim() || undefined,
      sensorWidthMm: sensorWidthMm ? Number(sensorWidthMm) : undefined,
      sensorHeightMm: sensorHeightMm ? Number(sensorHeightMm) : undefined,
      pixelSizeUm: pixelSizeUm ? Number(pixelSizeUm) : undefined,
      resolutionWidthPx: resolutionWidthPx ? Number(resolutionWidthPx) : undefined,
      resolutionHeightPx: resolutionHeightPx ? Number(resolutionHeightPx) : undefined,
      defaultGain: defaultGain ? Number(defaultGain) : undefined,
      dateAdded: editing?.dateAdded ?? nowIso(),
    })
    reset()
  }

  if (!cameras) return null

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <form onSubmit={add}>
          <div className="form-row">
            <div className="form-field autocomplete-wrap">
              <label>Description</label>
              <input
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  if (editing) return
                  setSensorWidthMm('')
                  setSensorHeightMm('')
                  setPixelSizeUm('')
                  setResolutionWidthPx('')
                  setResolutionHeightPx('')
                  setDefaultGain('')
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
            <div className="form-field" style={{ flex: '0 0 7rem' }}>
              <label>Default gain</label>
              <input
                value={defaultGain}
                onChange={(e) => setDefaultGain(e.target.value)}
                type="number"
                placeholder="e.g. 100"
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

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <FormActions editing={!!editing} onCancel={reset} />
          </div>
        </form>
      </div>
      <CatalogList
        name="cameras"
        items={cameras}
        usage={usage}
        emptyText="No cameras added yet."
        onEdit={startEdit}
        renderItem={(c) => (
          <>
            {c.description} {c.cameraType && <span className="muted">({c.cameraType})</span>}
            {(c.sensorWidthMm || c.defaultGain !== undefined) && (
              <div className="muted" style={{ fontSize: '0.78rem' }}>
                {c.sensorWidthMm && c.pixelSizeUm && (
                  <>
                    {c.sensorWidthMm} &times; {c.sensorHeightMm}mm &middot; {c.pixelSizeUm}
                    {'µ'}m pixels
                    {c.resolutionWidthPx && ` · ${c.resolutionWidthPx}×${c.resolutionHeightPx}`}
                  </>
                )}
                {c.defaultGain !== undefined && ` · Default gain ${c.defaultGain}`}
              </div>
            )}
          </>
        )}
      />
    </div>
  )
}

function TelescopesTab() {
  const telescopes = byDescription(useCollection<Telescope>('telescopes'))
  const usage = useGearUsage()
  const [editing, setEditing] = useState<Telescope | null>(null)
  const [description, setDescription] = useState('')
  const [focalLength, setFocalLength] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestions = showSuggestions ? searchTelescopeCatalog(description) : []

  function applySpec(spec: TelescopeSpec) {
    setDescription(spec.model)
    setFocalLength(String(spec.focalLengthMm))
    setShowSuggestions(false)
  }

  function handleBlur() {
    setTimeout(() => setShowSuggestions(false), 150)
    if (!focalLength) {
      const spec = findTelescopeSpec(description)
      if (spec) applySpec(spec)
    }
  }

  function reset() {
    setEditing(null)
    setDescription('')
    setFocalLength('')
  }

  function startEdit(t: Telescope) {
    setEditing(t)
    setDescription(t.description)
    setFocalLength(t.focalLength ?? '')
    setShowSuggestions(false)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<Telescope>('telescopes', {
      ...editing,
      id: editing?.id ?? newId(),
      description: description.trim(),
      focalLength: focalLength.trim() || undefined,
      dateAdded: editing?.dateAdded ?? nowIso(),
    })
    reset()
  }

  if (!telescopes) return null

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <form onSubmit={add} className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-field autocomplete-wrap">
            <label>Description</label>
            <input
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                if (!editing) setFocalLength('')
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={handleBlur}
              autoComplete="off"
              placeholder="e.g. 8in RC Telescope"
            />
            <Suggestions
              items={suggestions.map((s) => `${s.model} (${s.focalLengthMm}mm)`)}
              onPick={(i) => applySpec(suggestions[i])}
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
          <FormActions editing={!!editing} onCancel={reset} />
        </form>
      </div>
      <CatalogList
        name="telescopes"
        items={telescopes}
        usage={usage}
        emptyText="No telescopes added yet."
        onEdit={startEdit}
        renderItem={(t) => (
          <>
            {t.description} {t.focalLength && <span className="muted">({t.focalLength}mm)</span>}
          </>
        )}
      />
    </div>
  )
}

function MountsTab() {
  const mounts = byDescription(useCollection<Mount>('mounts'))
  const usage = useGearUsage()
  const [editing, setEditing] = useState<Mount | null>(null)
  const [description, setDescription] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestions = showSuggestions ? searchMountCatalog(description) : []

  function reset() {
    setEditing(null)
    setDescription('')
  }

  function startEdit(m: Mount) {
    setEditing(m)
    setDescription(m.description)
    setShowSuggestions(false)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<Mount>('mounts', {
      ...editing,
      id: editing?.id ?? newId(),
      description: description.trim(),
      dateAdded: editing?.dateAdded ?? nowIso(),
    })
    reset()
  }

  if (!mounts) return null

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <form onSubmit={add} className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-field autocomplete-wrap">
            <label>Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              autoComplete="off"
              placeholder="e.g. EQ6-R Pro"
            />
            <Suggestions
              items={suggestions}
              onPick={(i) => {
                setDescription(suggestions[i])
                setShowSuggestions(false)
              }}
            />
          </div>
          <FormActions editing={!!editing} onCancel={reset} />
        </form>
      </div>
      <CatalogList
        name="mounts"
        items={mounts}
        usage={usage}
        emptyText="No mounts added yet."
        onEdit={startEdit}
        renderItem={(m) => m.description}
      />
    </div>
  )
}

function FiltersTab() {
  const filters = sortedFilters(useCollection<FilterDef>('filters'))
  const usage = useGearUsage()
  const [editing, setEditing] = useState<FilterDef | null>(null)
  const [description, setDescription] = useState('')
  const [position, setPosition] = useState('')

  function reset() {
    setEditing(null)
    setDescription('')
    setPosition('')
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<FilterDef>('filters', {
      ...editing,
      id: editing?.id ?? newId(),
      description: description.trim(),
      position: position && Number(position) >= 1 ? Math.floor(Number(position)) : undefined,
      dateAdded: editing?.dateAdded ?? nowIso(),
    })
    reset()
  }

  if (!filters) return null

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <form onSubmit={add} className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-field">
            <label>Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Ha"
            />
          </div>
          <div className="form-field" style={{ flex: '0 0 7rem' }}>
            <label>Position</label>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 1"
            />
          </div>
          <FormActions editing={!!editing} onCancel={reset} />
        </form>
      </div>
      <CatalogList
        name="filters"
        items={filters}
        usage={usage}
        emptyText="No filters added yet."
        onEdit={(f) => {
          setEditing(f)
          setDescription(f.description)
          setPosition(f.position !== undefined ? String(f.position) : '')
        }}
        renderItem={(f) => (
          <>
            {f.description} {f.position !== undefined && <span className="muted">(position {f.position})</span>}
          </>
        )}
      />
    </div>
  )
}

function LocationsTab() {
  const locations = byDescription(useCollection<Location>('locations'))
  const [editing, setEditing] = useState<Location | null>(null)
  const [description, setDescription] = useState('')

  function reset() {
    setEditing(null)
    setDescription('')
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<Location>('locations', {
      ...editing,
      id: editing?.id ?? newId(),
      description: description.trim(),
      dateAdded: editing?.dateAdded ?? nowIso(),
    })
    reset()
  }

  async function remove(id: string) {
    await removeDoc('locations', id)
  }

  if (!locations) return null

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <form onSubmit={add} className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-field">
            <label>Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Remote Observatory - Utah"
            />
          </div>
          <FormActions editing={!!editing} onCancel={reset} />
        </form>
      </div>
      <div className="card">
        {locations.length === 0 && <div className="muted">No locations added yet.</div>}
        {locations.map((l) => (
          <div className="list-item" key={l.id}>
            <span>{l.description}</span>
            <RowButtons
              onEdit={() => {
                setEditing(l)
                setDescription(l.description)
              }}
              onRemove={() => remove(l.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
