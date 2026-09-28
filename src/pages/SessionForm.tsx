import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso } from '../db/db'
import { PIPELINE_STATUSES, type PipelineStatus, type Session } from '../types/models'
import { PIPELINE_STATUS_LABEL } from '../lib/status'
import { useKnownLocations } from '../lib/locations'

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
  const knownLocations = useKnownLocations()

  const [date, setDate] = useState(today())
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<PipelineStatus>('captured')
  const [filePath, setFilePath] = useState('')
  const [notes, setNotes] = useState('')
  const [loaded, setLoaded] = useState(false)

  if (isEdit && existing && !loaded) {
    setDate(existing.date)
    setLocation(existing.location || '')
    setStatus(existing.status)
    setFilePath(existing.filePath || '')
    setNotes(existing.notes || '')
    setLoaded(true)
  }

  if (isEdit && !existing) return null
  if (!projectId) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const base = {
      projectId: projectId!,
      date,
      location: location.trim() || undefined,
      status,
      filePath: filePath.trim() || undefined,
      notes: notes.trim() || undefined,
      updatedAt: nowIso(),
    }

    if (isEdit && existing) {
      await db.sessions.put({ ...existing, ...base })
      navigate(`/projects/${projectId}/sessions/${existing.id}`)
    } else {
      const session: Session = { id: newId(), createdAt: nowIso(), ...base }
      await db.sessions.add(session)
      navigate(`/projects/${projectId}/sessions/${session.id}`)
    }
  }

  async function handleDelete() {
    if (!existing) return
    if (!confirm('Delete this session and all its frames?')) return
    await db.frames.where('sessionId').equals(existing.id).delete()
    await db.sessions.delete(existing.id)
    navigate(`/projects/${projectId}`)
  }

  const backTo = isEdit ? `/projects/${projectId}/sessions/${sessionId}` : `/projects/${projectId}`

  return (
    <div>
      <Link to={backTo} className="back-link">
        &lsaquo; {isEdit ? 'Session' : 'Project'}
      </Link>
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
            <input
              id="location"
              list="known-locations"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <datalist id="known-locations">
              {knownLocations.map((loc) => (
                <option value={loc} key={loc} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as PipelineStatus)}
            >
              {PIPELINE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PIPELINE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="filePath">File path</label>
            <input
              id="filePath"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="Where this session's files live"
            />
          </div>
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
