import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { bulkPut, putDoc, useCollection, useDocument } from '../firebase/firestoreDb'
import { newId, nowIso } from '../lib/ids'
import { today } from '../lib/format'
import { sortFilters } from '../lib/filters'
import { flatDarkFor } from '../lib/flatDarks'
import { useKnownLocations } from '../lib/locations'
import {
  buildSessionGear,
  defaultGearIds,
  effectiveReplacements,
  idsFromGear,
  remapFilterId,
  useGearCatalog,
  type GearIds,
} from '../lib/gear'
import { GearFields } from '../components/GearFields'
import type { FilterDef, Frame, Session } from '../types/models'

const DEFAULT_FLAT_COUNT = 20

// Copies a session for the next night on the same target. Light frames (and
// any darks/bias) carry over as-is; flats are session-specific, so they are
// never copied - instead every filter used by a light batch gets a fresh flat
// batch, and a matching flat dark batch, for the new session.
export function CopySession() {
  const { projectId, sessionId } = useParams()
  const navigate = useNavigate()

  const source = useDocument<Session>('sessions', sessionId)
  const sourceFrames = useCollection<Frame>('frames', { field: 'sessionId', value: sessionId })
  const filtersRaw = useCollection<FilterDef>('filters')
  const catalog = useGearCatalog()
  const knownLocations = useKnownLocations()

  const [date, setDate] = useState(today())
  const [location, setLocation] = useState('')
  const [filePath, setFilePath] = useState('')
  const [notes, setNotes] = useState('')
  const [flatCount, setFlatCount] = useState(DEFAULT_FLAT_COUNT)
  const [loaded, setLoaded] = useState(false)
  // Starts from the gear the source session used, skipping anything retired since.
  const [gearIds, setGearIds] = useState<GearIds | null>(null)
  // Where batches go when a filter is dropped for the new night (e.g. S -> H),
  // where that differs from the automatic pairing.
  const [replacementOverrides, setReplacementOverrides] = useState<Record<string, string>>({})

  if (gearIds === null && source && catalog) {
    setGearIds(defaultGearIds(catalog, idsFromGear(source.gear)))
  }

  if (source && !loaded) {
    setLocation(source.location || '')
    setFilePath(source.filePath || '')
    setNotes(source.notes || '')
    setLoaded(true)
  }

  if (!source || !sourceFrames || !filtersRaw || !projectId || !catalog || !gearIds) return null

  const frames = sourceFrames
  const filters = sortFilters(filtersRaw)
  const liveFilterName = (id: string | undefined) => filters.find((f) => f.id === id)?.description
  const filterName = (id: string) => liveFilterName(id) ?? 'Unknown'

  const originalFilterIds = idsFromGear(source.gear).filterIds
  const usedFilterIds = frames.map((f) => f.filterId)
  const replacements = effectiveReplacements(originalFilterIds, gearIds.filterIds, usedFilterIds, replacementOverrides)
  // A source batch's filter as it will be on the new session.
  const mapFilter = (id: string | undefined) => remapFilterId(id, gearIds.filterIds, replacements)

  const lights = frames.filter((f) => f.frameType === 'light')
  // Darks/bias aren't tied to a night's sky, so they come along unchanged.
  const otherCarryOver = frames.filter((f) => f.frameType === 'dark' || f.frameType === 'bias')

  // One flat per distinct filter across the light batches, in filter order -
  // after mapping, so two source filters moved onto the same new one share a flat.
  const lightFilterIds = [...new Set(lights.map((f) => mapFilter(f.filterId)).filter((id): id is string => !!id))]
  lightFilterIds.sort((a, b) => filters.findIndex((f) => f.id === a) - filters.findIndex((f) => f.id === b))

  // Reuse the exposure from the source session's flat for that filter when
  // there is one; otherwise 0 means "not yet known" (see FrameForm).
  function flatExposureFor(filterId: string): number {
    return (
      frames.find((f) => f.frameType === 'flat' && mapFilter(f.filterId) === filterId)?.exposureSeconds ?? 0
    )
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
      // Fresh snapshot from the catalog: this is tonight's gear, not a copy of
      // last night's record.
      gear: buildSessionGear(gearIds!, catalog!),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await putDoc<Session>('sessions', newSession)

    const copied: Frame[] = [...lights, ...otherCarryOver].map((f) => {
      const filterId = mapFilter(f.filterId)
      return {
        ...f,
        id: newId(),
        sessionId: newSession.id,
        filterId,
        filterName: filterId ? (liveFilterName(filterId) ?? f.filterName) : undefined,
        status: 'planning',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
    })

    const flats: Frame[] = lightFilterIds.map((filterId) => {
      const light = lights.find((f) => mapFilter(f.filterId) === filterId)!
      return {
        id: newId(),
        sessionId: newSession.id,
        projectId: source.projectId,
        frameType: 'flat',
        filterId,
        filterName: liveFilterName(filterId),
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

    // Every flat needs a flat dark at the same exposure, so they're always
    // built from the new flats (one per filter). The original's flat dark
    // count is reused when it had one.
    const flatDarks: Frame[] = flats.map((flat) =>
      flatDarkFor(
        flat,
        frames.find((f) => f.frameType === 'flat-dark' && mapFilter(f.filterId) === flat.filterId)?.count ??
          flatCount,
      ),
    )

    const all = [...copied, ...flats, ...flatDarks]
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

        <GearFields
          catalog={catalog}
          ids={gearIds}
          onChange={setGearIds}
          originalFilterIds={originalFilterIds}
          usedFilterIds={usedFilterIds}
          replacementOverrides={replacementOverrides}
          onReplacementOverridesChange={setReplacementOverrides}
        />

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
              {' '}Matching flat darks are created for each flat too.
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
