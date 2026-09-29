import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { bulkPut, getWhere, putDoc, removeDoc, removeWhere, useDocument } from '../firebase/firestoreDb'
import { newId, nowIso } from '../lib/ids'
import { CAPTURE_STATUSES, type CaptureStatus, type Frame, type Session } from '../types/models'
import { CAPTURE_STATUS_LABEL } from '../lib/status'
import { useKnownLocations } from '../lib/locations'
import { today } from '../lib/format'

export function SessionForm() {
  const { projectId, sessionId } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(sessionId)

  const existing = useDocument<Session>('sessions', sessionId)
  const knownLocations = useKnownLocations()

  const [date, setDate] = useState(today())
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<CaptureStatus>('planning')
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
      await putDoc<Session>('sessions', { ...existing, ...base })

      // Marking a session as planning means nothing in it has actually been
      // shot yet, so its frame batches shouldn't claim a further-along
      // status either - cascade down to keep them consistent. Other status
      // changes don't cascade: a session moving on doesn't mean every frame
      // batch in it has too.
      if (status === 'planning') {
        const sessionFrames = await getWhere<Frame>('frames', 'sessionId', existing.id)
        const toUpdate = sessionFrames.filter((f) => f.status !== 'planning')
        if (toUpdate.length > 0) {
          await bulkPut<Frame>(
            'frames',
            toUpdate.map((f) => ({ ...f, status: 'planning', updatedAt: nowIso() })),
          )
        }
      }

      navigate(`/projects/${projectId}/sessions/${existing.id}`)
    } else {
      const session: Session = { id: newId(), createdAt: nowIso(), ...base }
      await putDoc<Session>('sessions', session)
      navigate(`/projects/${projectId}/sessions/${session.id}`)
    }
  }

  async function handleDelete() {
    if (!existing) return
    if (!confirm('Delete this session and all its frames?')) return
    await removeWhere<Frame>('frames', 'sessionId', existing.id)
    await removeDoc('sessions', existing.id)
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
              onChange={(e) => setStatus(e.target.value as CaptureStatus)}
            >
              {CAPTURE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CAPTURE_STATUS_LABEL[s]}
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
