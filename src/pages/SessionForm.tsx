import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { bulkPut, getWhere, putDoc, removeDoc, removeWhere, useCollection, useDocument } from '../firebase/firestoreDb'
import { newId, nowIso } from '../lib/ids'
import { CAPTURE_STATUSES, type CaptureStatus, type Frame, type Session } from '../types/models'
import { CAPTURE_STATUS_LABEL } from '../lib/status'
import { useKnownLocations } from '../lib/locations'
import { today } from '../lib/format'
import {
  buildSessionGear,
  defaultGearIds,
  effectiveReplacements,
  filtersEditable,
  idsFromGear,
  remapFilterId,
  useGearCatalog,
  type GearIds,
} from '../lib/gear'
import { GearFields } from '../components/GearFields'

export function SessionForm() {
  const { projectId, sessionId } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(sessionId)

  const existing = useDocument<Session>('sessions', sessionId)
  const catalog = useGearCatalog()
  const projectSessions = useCollection<Session>('sessions', { field: 'projectId', value: projectId })
  const sessionFrames = useCollection<Frame>('frames', { field: 'sessionId', value: sessionId })
  const knownLocations = useKnownLocations()

  const [date, setDate] = useState(today())
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<CaptureStatus>('planning')
  const [filePath, setFilePath] = useState('')
  const [notes, setNotes] = useState('')
  const [loaded, setLoaded] = useState(false)
  // null until initialised: a new session starts from the project's most
  // recent session's gear (minus anything retired since); an existing one from
  // what it recorded.
  const [gearIds, setGearIds] = useState<GearIds | null>(null)
  // Where batches on a dropped filter move to, where that differs from the
  // automatic pairing (see GearFields).
  const [replacementOverrides, setReplacementOverrides] = useState<Record<string, string>>({})

  if (gearIds === null && catalog && projectSessions && (!isEdit || existing)) {
    if (existing) setGearIds(idsFromGear(existing.gear))
    else {
      const latest = [...projectSessions].sort((a, b) => b.date.localeCompare(a.date))[0]
      setGearIds(defaultGearIds(catalog, idsFromGear(latest?.gear)))
    }
  }

  if (isEdit && existing && !loaded) {
    setDate(existing.date)
    setLocation(existing.location || '')
    setStatus(existing.status)
    setFilePath(existing.filePath || '')
    setNotes(existing.notes || '')
    setLoaded(true)
  }

  if (isEdit && !existing) return null
  if (!projectId || !catalog || !gearIds || !sessionFrames) return null

  const originalFilterIds = existing ? idsFromGear(existing.gear).filterIds : []
  const usedFilterIds = sessionFrames.map((f) => f.filterId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const base = {
      projectId: projectId!,
      date,
      location: location.trim() || undefined,
      status,
      filePath: filePath.trim() || undefined,
      notes: notes.trim() || undefined,
      gear: buildSessionGear(gearIds!, catalog!, existing?.gear),
      updatedAt: nowIso(),
    }

    if (isEdit && existing) {
      await putDoc<Session>('sessions', { ...existing, ...base })

      // Filters only change while the session is planned. Batches that used a
      // filter that was dropped follow it to its replacement.
      if (filtersEditable(status)) {
        const replacements = effectiveReplacements(
          originalFilterIds,
          gearIds!.filterIds,
          usedFilterIds,
          replacementOverrides,
        )
        const remapped = sessionFrames!
          .filter((f) => f.filterId && !gearIds!.filterIds.includes(f.filterId))
          .map((f) => {
            const filterId = remapFilterId(f.filterId, gearIds!.filterIds, replacements)
            const filterName = filterId ? catalog!.filters.find((x) => x.id === filterId)?.description : undefined
            return { ...f, filterId, filterName, updatedAt: nowIso() }
          })
        if (remapped.length > 0) await bulkPut<Frame>('frames', remapped)
      }

      // Marking a session as planning means nothing in it has actually been
      // shot yet, so its frame batches shouldn't claim a further-along
      // status either - cascade down to keep them consistent. Other status
      // changes don't cascade: a session moving on doesn't mean every frame
      // batch in it has too.
      if (status === 'planning') {
        const sessionFramesNow = await getWhere<Frame>('frames', 'sessionId', existing.id)
        const toUpdate = sessionFramesNow.filter((f) => f.status !== 'planning')
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

        <GearFields
          catalog={catalog}
          ids={gearIds}
          onChange={setGearIds}
          filtersLocked={!filtersEditable(status)}
          originalFilterIds={originalFilterIds}
          usedFilterIds={usedFilterIds}
          replacementOverrides={replacementOverrides}
          onReplacementOverridesChange={setReplacementOverrides}
        />

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
