import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso } from '../db/db'
import type { Session, SessionExposure } from '../types/models'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function SessionForm() {
  const { projectId, sessionId } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(sessionId)

  const existing = useLiveQuery(
    () => (sessionId ? db.sessions.get(sessionId) : undefined),
    [sessionId],
  )
  const locations = useLiveQuery(() => db.locations.orderBy('name').toArray(), [])
  const equipmentList = useLiveQuery(() => db.equipment.orderBy('name').toArray(), [])
  const filters = useLiveQuery(() => db.filters.orderBy('name').toArray(), [])

  const [date, setDate] = useState(today())
  const [locationId, setLocationId] = useState('')
  const [equipmentIds, setEquipmentIds] = useState<string[]>([])
  const [exposures, setExposures] = useState<SessionExposure[]>([])
  const [seeingNotes, setSeeingNotes] = useState('')
  const [weatherNotes, setWeatherNotes] = useState('')
  const [moonIllumination, setMoonIllumination] = useState('')
  const [notes, setNotes] = useState('')
  const [loaded, setLoaded] = useState(false)

  if (isEdit && existing && !loaded) {
    setDate(existing.date)
    setLocationId(existing.locationId || '')
    setEquipmentIds(existing.equipmentIds)
    setExposures(existing.exposures)
    setSeeingNotes(existing.seeingNotes || '')
    setWeatherNotes(existing.weatherNotes || '')
    setMoonIllumination(existing.moonIllumination?.toString() || '')
    setNotes(existing.notes || '')
    setLoaded(true)
  }

  if (!locations || !equipmentList || !filters) return null
  if (isEdit && !existing) return null
  if (!projectId) return null

  function addExposureRow() {
    if (filters!.length === 0) return
    setExposures((prev) => [
      ...prev,
      { filterId: filters![0].id, subExposureSeconds: 300, subCount: 1 },
    ])
  }

  function updateExposure(index: number, patch: Partial<SessionExposure>) {
    setExposures((prev) =>
      prev.map((exp, i) => (i === index ? { ...exp, ...patch } : exp)),
    )
  }

  function removeExposure(index: number) {
    setExposures((prev) => prev.filter((_, i) => i !== index))
  }

  function toggleEquipment(id: string) {
    setEquipmentIds((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const base = {
      projectId: projectId!,
      date,
      locationId: locationId || undefined,
      equipmentIds,
      exposures,
      seeingNotes: seeingNotes.trim() || undefined,
      weatherNotes: weatherNotes.trim() || undefined,
      moonIllumination: moonIllumination ? Number(moonIllumination) : undefined,
      notes: notes.trim() || undefined,
      updatedAt: nowIso(),
    }

    if (isEdit && existing) {
      await db.sessions.put({ ...existing, ...base })
    } else {
      const session: Session = { id: newId(), createdAt: nowIso(), ...base }
      await db.sessions.add(session)
    }
    navigate(`/projects/${projectId}`)
  }

  async function handleDelete() {
    if (!existing) return
    if (!confirm('Delete this session?')) return
    await db.sessions.delete(existing.id)
    navigate(`/projects/${projectId}`)
  }

  return (
    <div>
      <div className="page-header">
        <h2>{isEdit ? 'Edit session' : 'New session'}</h2>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="location">Location</label>
            <select
              id="location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">Not set</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {equipmentList.length > 0 && (
          <div className="form-field">
            <label>Equipment used</label>
            <div className="card">
              {equipmentList.map((eq) => (
                <label
                  key={eq.id}
                  className="list-item"
                  style={{ cursor: 'pointer' }}
                >
                  <span>
                    {eq.name} <span className="muted">({eq.type})</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={equipmentIds.includes(eq.id)}
                    onChange={() => toggleEquipment(eq.id)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-field">
          <label>Exposures by filter</label>
          {exposures.map((exp, i) => (
            <div className="form-row" key={i} style={{ marginBottom: '0.5rem', alignItems: 'flex-end' }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <select
                  value={exp.filterId}
                  onChange={(e) => updateExposure(i, { filterId: e.target.value })}
                >
                  {filters.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field" style={{ marginBottom: 0, flex: '0 0 5.5rem' }}>
                <input
                  type="number"
                  min={0}
                  placeholder="sec"
                  value={exp.subExposureSeconds}
                  onChange={(e) =>
                    updateExposure(i, { subExposureSeconds: Number(e.target.value) })
                  }
                />
              </div>
              <div className="form-field" style={{ marginBottom: 0, flex: '0 0 4rem' }}>
                <input
                  type="number"
                  min={0}
                  placeholder="# subs"
                  value={exp.subCount}
                  onChange={(e) => updateExposure(i, { subCount: Number(e.target.value) })}
                />
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => removeExposure(i)}
                aria-label="Remove"
              >
                &#x2715;
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={addExposureRow}>
            + Add filter row
          </button>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="seeing">Seeing notes</label>
            <input
              id="seeing"
              value={seeingNotes}
              onChange={(e) => setSeeingNotes(e.target.value)}
              placeholder="e.g. 2.5 arcsec FWHM"
            />
          </div>
          <div className="form-field">
            <label htmlFor="moon">Moon illumination %</label>
            <input
              id="moon"
              type="number"
              min={0}
              max={100}
              value={moonIllumination}
              onChange={(e) => setMoonIllumination(e.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="weather">Weather notes</label>
          <input
            id="weather"
            value={weatherNotes}
            onChange={(e) => setWeatherNotes(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-block">
            {isEdit ? 'Save changes' : 'Log session'}
          </button>
          {isEdit && (
            <button type="button" className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
