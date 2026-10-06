import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { bulkPut, putDoc, useCollection, useDocument } from '../firebase/firestoreDb'
import { newId, nowIso } from '../lib/ids'
import { today } from '../lib/format'
import { sortFilters } from '../lib/filters'
import { useKnownLocations } from '../lib/locations'
import type { FilterDef, Frame, Session } from '../types/models'

const DEFAULT_FLAT_COUNT = 20

// Copies a session for the next night on the same target. Light frames (and
// any darks/bias) carry over as-is; flats are session-specific, so they are
// never copied - instead every filter used by a light batch gets a fresh flat
// batch for the new session.
export function CopySession() {
  const { projectId, sessionId } = useParams()
  const navigate = useNavigate()

  const source = useDocument<Session>('sessions', sessionId)
  const sourceFrames = useCollection<Frame>('frames', { field: 'sessionId', value: sessionId })
  const filtersRaw = useCollection<FilterDef>('filters')
  const knownLocations = useKnownLocations()

  const [date, setDate] = useState(today())
  const [location, setLocation] = useState('')
  const [filePath, setFilePath] = useState('')
  const [notes, setNotes] = useState('')
  const [flatCount, setFlatCount] = useState(DEFAULT_FLAT_COUNT)
  const [loaded, setLoaded] = useState(false)

  if (source && !loaded) {
    setLocation(source.location || '')
    setFilePath(source.filePath || '')
    setNotes(source.notes || '')
    setLoaded(true)
  }

  if (!source || !sourceFrames || !filtersRaw || !projectId) return null

  const frames = sourceFrames
  const filters = sortFilters(filtersRaw)
  const filterName = (id: string) => filters.find((f) => f.id === id)?.description ?? 'Unknown'

  const lights = frames.filter((f) => f.frameType === 'light')
  // Darks/bias aren't tied to a night's sky, so they come along unchanged.
  const otherCarryOver = frames.filter((f) => f.frameType === 'dark' || f.frameType === 'bias')

  // One flat per distinct filter across the light batches, in filter order.
  const lightFilterIds = [...new Set(lights.map((f) => f.filterId).filter((id): id is string => !!id))]
  lightFilterIds.sort((a, b) => filters.findIndex((f) => f.id === a) - filters.findIndex((f) => f.id === b))

  // Reuse the exposure from the source session's flat for that filter when
  // there is one; otherwise 0 means "not yet known" (see FrameForm).
  function flatExposureFor(filterId: string): number {
    return frames.find((f) => f.frameType === 'flat' && f.filterId === filterId)?.exposureSeconds ?? 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!source) return

    const newSession: Session = {
      id: newId(),
      projectId: source.projectId,
      date,
      location: location.trim() || undefined,
      status: 'planning',
      filePath: filePath.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await putDoc<Session>('sessions', newSession)

    const copied: Frame[] = [...lights, ...otherCarryOver].map((f) => ({
      ...f,
      id: newId(),
      sessionId: newSession.id,
      status: 'planning',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }))

    const flats: Frame[] = lightFilterIds.map((filterId) => {
      const light = lights.find((f) => f.filterId === filterId)!
      return {
        id: newId(),
        sessionId: newSession.id,
        projectId: source.projectId,
        frameType: 'flat',
        filterId,
        count: flatCount,
        exposureSeconds: flatExposureFor(filterId),
        gain: light.gain,
        offset: light.offset,
        tempF: light.tempF,
        binning: light.binning,
        status: 'planning',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
    })

    const all = [...copied, ...flats]
    if (all.length > 0) await bulkPut<Frame>('frames', all)

    navigate(`/projects/${projectId}/sessions/${newSession.id}`)
  }

  return (
    <div>
      <Link to={`/projects/${projectId}/sessions/${source.id}`} className="back-link">
        &lsaquo; Session
      </Link>
      <div className="page-header">
        <h2>Copy session</h2>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="date">Date</label>
            <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
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

        <div className="form-field">
          <label htmlFor="filePath">File path</label>
          <input
            id="filePath"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="Where this session's files live"
          />
        </div>

        <div className="form-field">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="card">
          <h3>What gets copied</h3>
          <div className="muted">
            {lights.length} light batch{lights.length === 1 ? '' : 'es'}
            {otherCarryOver.length > 0 &&
              ` + ${otherCarryOver.length} dark/bias batch${otherCarryOver.length === 1 ? '' : 'es'}`}
            , all set to Planning.
          </div>
          <div className="form-field" style={{ marginTop: '0.75rem' }}>
            <label htmlFor="flatCount"># Flat frames per filter</label>
            <input
              id="flatCount"
              type="number"
              min={0}
              value={flatCount}
              onChange={(e) => setFlatCount(Number(e.target.value))}
            />
          </div>
          {lightFilterIds.length > 0 ? (
            <div className="muted">
              New flats for this session: {lightFilterIds.map(filterName).join(', ')}. Flats are
              never copied from the original - each session gets its own. Exposure is reused
              from the original session&rsquo;s flat for that filter, or left at 0 to fill in
              later.
            </div>
          ) : (
            <div className="muted">No filtered light frames in this session, so no flats will be created.</div>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-block">
            Create copy
          </button>
        </div>
      </form>
    </div>
  )
}
