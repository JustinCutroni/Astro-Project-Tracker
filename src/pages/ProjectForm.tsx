import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso } from '../db/db'
import { PROJECT_STATUSES, type Project, type ProjectStatus } from '../types/models'
import { PROJECT_STATUS_LABEL } from '../lib/status'
import { useKnownLocations } from '../lib/locations'
import { formatTarget, searchTargets } from '../lib/targetSearch'

export function ProjectForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const existing = useLiveQuery(() => (id ? db.projects.get(id) : undefined), [id])
  const cameras = useLiveQuery(() => db.cameras.orderBy('description').toArray(), [])
  const telescopes = useLiveQuery(() => db.telescopes.orderBy('description').toArray(), [])
  const mounts = useLiveQuery(() => db.mounts.orderBy('description').toArray(), [])
  const filters = useLiveQuery(() => db.filters.orderBy('description').toArray(), [])
  const knownLocations = useKnownLocations()

  const [target, setTarget] = useState('')
  const [projectName, setProjectName] = useState('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [goalHours, setGoalHours] = useState('')
  const [storageRoot, setStorageRoot] = useState('')
  const [notes, setNotes] = useState('')
  const [cameraId, setCameraId] = useState('')
  const [telescopeId, setTelescopeId] = useState('')
  const [mountId, setMountId] = useState('')
  const [filterIds, setFilterIds] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showTargetSuggestions, setShowTargetSuggestions] = useState(false)
  const targetSuggestions = showTargetSuggestions ? searchTargets(target) : []

  if (isEdit && existing && !loaded) {
    setTarget(existing.target)
    setProjectName(existing.projectName || '')
    setLocation(existing.location || '')
    setStatus(existing.status)
    setGoalHours(existing.goalHours || '')
    setStorageRoot(existing.storageRoot || '')
    setNotes(existing.notes || '')
    setCameraId(existing.cameraId || '')
    setTelescopeId(existing.telescopeId || '')
    setMountId(existing.mountId || '')
    setFilterIds(existing.filterIds)
    setLoaded(true)
  }

  if (isEdit && !existing) return null
  if (!cameras || !telescopes || !mounts || !filters) return null

  function toggleFilter(id: string) {
    setFilterIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target.trim()) return

    const base = {
      target: target.trim(),
      projectName: projectName.trim() || undefined,
      location: location.trim() || undefined,
      status,
      goalHours: goalHours.trim() || undefined,
      storageRoot: storageRoot.trim() || undefined,
      notes: notes.trim() || undefined,
      cameraId: cameraId || undefined,
      telescopeId: telescopeId || undefined,
      mountId: mountId || undefined,
      filterIds,
      updatedAt: nowIso(),
    }

    if (isEdit && existing) {
      await db.projects.put({ ...existing, ...base })
      navigate(`/projects/${existing.id}`)
    } else {
      const project: Project = { id: newId(), createdAt: nowIso(), ...base }
      await db.projects.add(project)
      navigate(`/projects/${project.id}`)
    }
  }

  return (
    <div>
      <Link to={isEdit ? `/projects/${id}` : '/projects'} className="back-link">
        &lsaquo; {isEdit ? 'Project' : 'Projects'}
      </Link>
      <div className="page-header">
        <h2>{isEdit ? 'Edit project' : 'New project'}</h2>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-field autocomplete-wrap">
          <label htmlFor="target">Target *</label>
          <input
            id="target"
            placeholder="e.g. M31 - Andromeda Galaxy"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onFocus={() => setShowTargetSuggestions(true)}
            onBlur={() => setTimeout(() => setShowTargetSuggestions(false), 150)}
            autoComplete="off"
            required
          />
          {targetSuggestions.length > 0 && (
            <ul className="suggestion-list">
              {targetSuggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setTarget(formatTarget(s))
                      setShowTargetSuggestions(false)
                    }}
                  >
                    {formatTarget(s)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="form-field">
          <label htmlFor="projectName">Project name (optional)</label>
          <input
            id="projectName"
            placeholder="Defaults to target name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              list="known-locations"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Remote Observatory - Utah"
            />
            <datalist id="known-locations">
              {knownLocations.map((loc) => (
                <option value={loc} key={loc} />
              ))}
            </datalist>
          </div>
          <div className="form-field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="goalHours">Goal hours</label>
            <input
              id="goalHours"
              placeholder="e.g. 20+"
              value={goalHours}
              onChange={(e) => setGoalHours(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="storageRoot">Storage location</label>
            <input
              id="storageRoot"
              placeholder="e.g. D:\Astro\M31"
              value={storageRoot}
              onChange={(e) => setStorageRoot(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="camera">Camera</label>
            <select id="camera" value={cameraId} onChange={(e) => setCameraId(e.target.value)}>
              <option value="">Not set</option>
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.description}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="telescope">Telescope</label>
            <select
              id="telescope"
              value={telescopeId}
              onChange={(e) => setTelescopeId(e.target.value)}
            >
              <option value="">Not set</option>
              {telescopes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.description}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="mount">Mount</label>
            <select id="mount" value={mountId} onChange={(e) => setMountId(e.target.value)}>
              <option value="">Not set</option>
              {mounts.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filters.length > 0 && (
          <div className="form-field">
            <label>Filters planned for this project</label>
            <div className="card">
              {filters.map((f) => (
                <label key={f.id} className="list-item" style={{ cursor: 'pointer' }}>
                  <span>{f.description}</span>
                  <input
                    type="checkbox"
                    checked={filterIds.includes(f.id)}
                    onChange={() => toggleFilter(f.id)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-field">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-block">
            {isEdit ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  )
}
