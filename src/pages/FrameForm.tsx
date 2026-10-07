import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { bulkPut, getWhere, putDoc, removeDoc, useDocument } from '../firebase/firestoreDb'
import { newId, nowIso } from '../lib/ids'
import { FRAME_TYPES, STATUSES, type Status, type Frame, type FrameType, type Session } from '../types/models'
import { FRAME_TYPE_LABEL, STATUS_LABEL } from '../lib/status'
import { rollUpSession } from '../lib/statusSync'
import { extractFitsFrameInfo } from '../lib/fitsHeader'
import { matchFilterCode } from '../lib/asiairFilenameParser'
import { sessionFilterOptions } from '../lib/gear'
import { flatDarkFor, flatDarksToResync } from '../lib/flatDarks'

export function FrameForm() {
  const { projectId, sessionId, frameId } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(frameId)

  const existing = useDocument<Frame>('frames', frameId)
  const session = useDocument<Session>('sessions', sessionId)

  const [frameType, setFrameType] = useState<FrameType>('light')
  const [filterId, setFilterId] = useState('')
  const [count, setCount] = useState(1)
  const [exposureSeconds, setExposureSeconds] = useState(180)
  const [gain, setGain] = useState('')
  const [offset, setOffset] = useState('')
  const [tempF, setTempF] = useState('')
  const [binning, setBinning] = useState('1x1')
  const [status, setStatus] = useState<Status>('planning')
  const [filePathPattern, setFilePathPattern] = useState('')
  const [notes, setNotes] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [duplicateToFilterIds, setDuplicateToFilterIds] = useState<string[]>([])
  const [statusDefaulted, setStatusDefaulted] = useState(false)
  const [gainDefaulted, setGainDefaulted] = useState(false)
  const [createFlat, setCreateFlat] = useState(false)
  const [flatCount, setFlatCount] = useState(20)
  const [flatExposureSeconds, setFlatExposureSeconds] = useState('')

  if (isEdit && existing && !loaded) {
    setFrameType(existing.frameType)
    setFilterId(existing.filterId || '')
    setCount(existing.count)
    setExposureSeconds(existing.exposureSeconds)
    setGain(existing.gain?.toString() || '')
    setOffset(existing.offset || '')
    setTempF(existing.tempF?.toString() || '')
    setBinning(existing.binning || '1x1')
    setStatus(existing.status)
    setFilePathPattern(existing.filePathPattern || '')
    setNotes(existing.notes || '')
    setLoaded(true)
  }

  // A new frame batch starts out at its session's status: a planned session
  // hasn't been shot yet, so neither has its batches.
  if (!isEdit && session && !statusDefaulted) {
    setStatus(session.status)
    setStatusDefaulted(true)
  }

  // Prefill gain from the session's camera's published optimal/unity gain,
  // once the session has loaded - still fully editable.
  const sessionCamera = session?.gear?.camera
  if (!isEdit && sessionCamera?.defaultGain !== undefined && !gain && !gainDefaulted) {
    setGain(String(sessionCamera.defaultGain))
    setGainDefaulted(true)
  }

  if (isEdit && !existing) return null
  if (!session || !projectId || !sessionId) return null

  const totalSeconds = count * exposureSeconds

  // Batches draw their filters from the session's own filter set. Editing a
  // batch keeps whatever filter it already has even if the session has since
  // dropped it.
  const filters = sessionFilterOptions(
    session,
    existing?.filterId ? { id: existing.filterId, description: existing.filterName ?? 'Unknown filter' } : undefined,
  )
  const hasSessionFilters = (session.gear?.filters?.length ?? 0) > 0
  const duplicateCandidates = sessionFilterOptions(session).filter((f) => f.id !== filterId)

  // The filter name is stored on the batch itself so it still reads right if
  // the catalog entry is later renamed or retired. Editing a batch without
  // changing its filter keeps the name it was logged with.
  function filterNameFor(id: string | undefined): string | undefined {
    if (!id) return undefined
    if (existing && existing.filterId === id && existing.filterName) return existing.filterName
    return filters.find((f) => f.id === id)?.description
  }

  function toggleDuplicateFilter(id: string) {
    setDuplicateToFilterIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
  }

  // Reads real metadata straight out of a captured FITS file's header,
  // rather than a filename convention - sidesteps ambiguities a filename
  // can have (e.g. ASIAIR's own "<n>F" filename suffix is actually Celsius,
  // confirmed against real captures) since FITS's CCD-TEMP keyword is
  // unambiguously Celsius by convention. Only fills in what the header
  // actually has; count is never touched, since a header describes one
  // frame, not a batch.
  async function handleFitsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const buffer = await file.arrayBuffer()
    const info = extractFitsFrameInfo(buffer)

    if (info.frameType) setFrameType(info.frameType)
    if (info.exposureSeconds !== undefined) setExposureSeconds(info.exposureSeconds)
    if (info.binning) setBinning(info.binning)
    if (info.gain !== undefined) setGain(String(info.gain))
    if (info.tempF !== undefined) setTempF(info.tempF.toFixed(1))
    if (info.filterName) {
      const matchedId = matchFilterCode(info.filterName, filters)
      if (matchedId) setFilterId(matchedId)
    }
    e.target.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const base = {
      projectId: projectId!,
      sessionId: sessionId!,
      frameType,
      filterId: filterId || undefined,
      filterName: filterNameFor(filterId || undefined),
      count,
      exposureSeconds,
      gain: gain ? Number(gain) : undefined,
      offset: offset.trim() || undefined,
      tempF: tempF ? Number(tempF) : undefined,
      binning: binning.trim() || undefined,
      status,
      filePathPattern: filePathPattern.trim() || undefined,
      notes: notes.trim() || undefined,
      updatedAt: nowIso(),
    }

    const written: Frame[] = []

    if (isEdit && existing) {
      const frame: Frame = { ...existing, ...base }
      await putDoc<Frame>('frames', frame)
      written.push(frame)

      const siblings = await getWhere<Frame>('frames', 'sessionId', sessionId!)
      const resynced = flatDarksToResync(existing, frame, siblings)
      if (resynced.length > 0) {
        await bulkPut<Frame>('frames', resynced)
        written.push(...resynced)
      }
    } else {
      const frame: Frame = { id: newId(), createdAt: nowIso(), ...base }
      await putDoc<Frame>('frames', frame)
      written.push(frame)
    }

    if (duplicateToFilterIds.length > 0) {
      const duplicates: Frame[] = duplicateToFilterIds.map((dupFilterId) => ({
        ...base,
        id: newId(),
        filterId: dupFilterId,
        filterName: filterNameFor(dupFilterId),
        createdAt: nowIso(),
      }))
      await bulkPut<Frame>('frames', duplicates)
      written.push(...duplicates)
    }

    // Flats need their own exposure (usually much shorter, often
    // auto-determined) and their own count, but otherwise calibrate this
    // exact light batch, so they're taken through the same filter and at
    // the same temperature. Exposure is commonly left blank here - ASIAIR's
    // "auto-exposure" flats don't have a fixed value until after capture,
    // when it's readable from the actual frame's filename - so 0 stands in
    // for "not yet known" rather than blocking the flat batch from being
    // created at all.
    // One flat batch per filter in this submission: the batch's own filter
    // plus every filter it's being duplicated to.
    if (createFlat) {
      const flatFilterIds = [base.filterId, ...duplicateToFilterIds]
      const flats: Frame[] = flatFilterIds.map((flatFilterId) => ({
        ...base,
        id: newId(),
        filterId: flatFilterId,
        filterName: filterNameFor(flatFilterId),
        frameType: 'flat',
        count: flatCount,
        exposureSeconds: flatExposureSeconds ? Number(flatExposureSeconds) : 0,
        createdAt: nowIso(),
      }))
      await bulkPut<Frame>('frames', flats)
      written.push(...flats)
    }

    // Flat darks calibrate flats, so every new flat batch gets a matching one
    // (same filter, exposure, gain, temp). Flats edited in place already have
    // theirs, so only newly created flats are covered.
    const newFlats = written.filter((f) => f.frameType === 'flat' && !(isEdit && f.id === existing?.id))
    if (newFlats.length > 0) {
      const flatDarks = newFlats.map((flat) => flatDarkFor(flat))
      await bulkPut<Frame>('frames', flatDarks)
      written.push(...flatDarks)
    }

    // The session advances if every batch in it has now moved past it.
    await rollUpSession(sessionId!, projectId!, { put: written })

    navigate(`/projects/${projectId}/sessions/${sessionId}`)
  }

  async function handleDelete() {
    if (!existing) return
    if (!confirm('Delete this frame batch?')) return
    await removeDoc('frames', existing.id)
    await rollUpSession(sessionId!, projectId!, { removedIds: [existing.id] })
    navigate(`/projects/${projectId}/sessions/${sessionId}`)
  }

  return (
    <div>
      <Link to={`/projects/${projectId}/sessions/${sessionId}`} className="back-link">
        &lsaquo; Session
      </Link>
      <div className="page-header">
        <h2>{isEdit ? 'Edit frames' : 'Add frames'}</h2>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="fitsFile">Load from a sample FITS file (optional)</label>
          <input id="fitsFile" type="file" accept=".fit,.fits" onChange={handleFitsFile} />
          <div className="muted" style={{ marginTop: '0.25rem' }}>
            Reads frame type, exposure, binning, gain, filter, and temperature straight out
            of the file's own header - only the count below still needs entering by hand.
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="frameType">Frame type</label>
            <select
              id="frameType"
              value={frameType}
              onChange={(e) => setFrameType(e.target.value as FrameType)}
            >
              {FRAME_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FRAME_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="filter">Filter</label>
            <select id="filter" value={filterId} onChange={(e) => setFilterId(e.target.value)}>
              <option value="">None</option>
              {filters.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.description}
                </option>
              ))}
            </select>
            {!hasSessionFilters && (
              <div className="muted" style={{ marginTop: '0.25rem' }}>
                This session has no filters set. Add them under Edit session to pick one here.
              </div>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="count"># Frames</label>
            <input
              id="count"
              type="number"
              min={0}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="exposureSeconds">Exposure (sec)</label>
            <input
              id="exposureSeconds"
              type="number"
              min={0}
              step="0.1"
              value={exposureSeconds}
              onChange={(e) => setExposureSeconds(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="gain">Gain</label>
            <input id="gain" type="number" value={gain} onChange={(e) => setGain(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="offset">Offset</label>
            <input id="offset" value={offset} onChange={(e) => setOffset(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="binning">Binning</label>
            <input id="binning" value={binning} onChange={(e) => setBinning(e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="tempF">Temp ({'°'}F)</label>
            <input
              id="tempF"
              type="number"
              step="0.1"
              value={tempF}
              onChange={(e) => setTempF(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="muted" style={{ marginBottom: '0.9rem' }}>
          Total: {totalSeconds}s ({(totalSeconds / 3600).toFixed(2)}h)
        </div>

        <div className="form-field">
          <label htmlFor="filePathPattern">File path</label>
          <input
            id="filePathPattern"
            value={filePathPattern}
            onChange={(e) => setFilePathPattern(e.target.value)}
            placeholder="Where these files live"
          />
        </div>

        <div className="form-field">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {frameType === 'light' && (
          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={createFlat}
                onChange={(e) => setCreateFlat(e.target.checked)}
              />
              Also create a matching flat frame batch
            </label>
            {createFlat && (
              <div className="form-row" style={{ marginTop: '0.5rem' }}>
                <div className="form-field">
                  <label htmlFor="flatCount"># Flat frames</label>
                  <input
                    id="flatCount"
                    type="number"
                    min={0}
                    value={flatCount}
                    onChange={(e) => setFlatCount(Number(e.target.value))}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="flatExposure">Flat exposure (sec)</label>
                  <input
                    id="flatExposure"
                    type="number"
                    min={0}
                    step="0.001"
                    value={flatExposureSeconds}
                    onChange={(e) => setFlatExposureSeconds(e.target.value)}
                    placeholder="leave blank if auto-exposure"
                  />
                </div>
              </div>
            )}
            <div className="muted" style={{ marginTop: '0.25rem' }}>
              One flat batch (plus a matching flat dark batch) is created for this filter and
              for each filter selected below.
              Uses the same binning and temperature as this batch - flats just need
              their own count and, usually, a much shorter exposure. Leave the exposure blank
              for auto-exposure flats - fill in the real value later once you can read it off
              the captured frames' filenames.
            </div>
          </div>
        )}

        {duplicateCandidates.length > 0 && (
          <div className="form-field">
            <label>Also create identical batches for</label>
            <div className="card">
              {duplicateCandidates.map((f) => (
                <label key={f.id} className="list-item" style={{ cursor: 'pointer' }}>
                  <span>{f.description}</span>
                  <input
                    type="checkbox"
                    checked={duplicateToFilterIds.includes(f.id)}
                    onChange={() => toggleDuplicateFilter(f.id)}
                  />
                </label>
              ))}
            </div>
            <div className="muted" style={{ marginTop: '0.25rem' }}>
              Copies everything above except the filter - count, exposure, gain, temp, etc. -
              into a new batch per filter checked, so you only need to adjust the count
              afterward if it was different.
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-block">
            {isEdit ? 'Save changes' : 'Add frames'}
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
