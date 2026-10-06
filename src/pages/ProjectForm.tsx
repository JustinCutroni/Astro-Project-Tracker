import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { putDoc, useDocument } from '../firebase/firestoreDb'
import { newId, nowIso } from '../lib/ids'
import { PROJECT_STATUSES, type Project, type ProjectStatus } from '../types/models'
import { PROJECT_STATUS_LABEL } from '../lib/status'
import { useKnownLocations } from '../lib/locations'
import { formatTarget, searchTargets } from '../lib/targetSearch'

export function ProjectForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const existing = useDocument<Project>('projects', id)
  const knownLocations = useKnownLocations()

  const [target, setTarget] = useState('')
  const [projectName, setProjectName] = useState('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [goalHours, setGoalHours] = useState('')
  const [storageRoot, setStorageRoot] = useState('')
  const [notes, setNotes] = useState('')
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
    setLoaded(true)
  }

  if (isEdit && !existing) return null

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
      updatedAt: nowIso(),
    }

    if (isEdit && existing) {
      await putDoc<Project>('projects', { ...existing, ...base })
      navigate(`/projects/${existing.id}`)
    } else {
      const project: Project = { id: newId(), createdAt: nowIso(), ...base }
      await putDoc<Project>('projects', project)
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
