import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { bulkPut, useCollection, useDocument, putDoc } from '../firebase/firestoreDb'
import { newId, nowIso } from '../lib/ids'
import { parseAsiairAutorunLog, type ParsedAsiairLog } from '../lib/asiairLogParser'
import { matchFilterCode, parseAsiairFilename } from '../lib/asiairFilenameParser'
import { FRAME_TYPES, CAPTURE_STATUSES, type FilterDef, type Frame, type FrameType, type CaptureStatus, type Project, type Session } from '../types/models'
import { FRAME_TYPE_LABEL, CAPTURE_STATUS_LABEL } from '../lib/status'
import { useKnownLocations } from '../lib/locations'
import { sortFilters } from '../lib/filters'
import { buildSessionGear, defaultGearIds, optionLabel, selectable, useGearCatalog, type GearIds } from '../lib/gear'
import { GearFields } from '../components/GearFields'
import { IconClose } from '../components/icons'

interface BatchDraft {
  key: string
  frameType: FrameType
  filterId: string
  count: number
  exposureSeconds: number
  gain: string
  offset: string
  tempF: string
  binning: string
  status: CaptureStatus
  plannedCount: number
  associatedTarget?: string
  notes: string[]
  sampleFilename: string
}

function draftsFromParsed(parsed: ParsedAsiairLog, filters: FilterDef[]): BatchDraft[] {
  return parsed.batches.map((b, i) => ({
    key: `${i}-${newId()}`,
    frameType: b.frameType,
    filterId: (b.filterCode && matchFilterCode(b.filterCode, filters)) || '',
    count: b.actualCount,
    exposureSeconds: b.exposureSeconds,
    gain: '',
    offset: '',
    tempF: b.tempF !== undefined ? String(b.tempF) : '',
    binning: b.binning,
    status: 'captured',
    plannedCount: b.plannedCount,
    associatedTarget: b.associatedTarget,
    notes: b.notes,
    sampleFilename: '',
  }))
}

export function ImportSessionLog() {
  const { projectId, sessionId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isExistingSession = Boolean(sessionId)
  const project = useDocument<Project>('projects', projectId)
  const existingSession = useDocument<Session>('sessions', sessionId)
  const filtersRaw = useCollection<FilterDef>('filters')
  const filters = filtersRaw && sortFilters(filtersRaw)
  const catalog = useGearCatalog()
  const knownLocations = useKnownLocations()

  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedAsiairLog | null>(null)
  const [fileName, setFileName] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [location, setLocation] = useState('')
  const [filePath, setFilePath] = useState('')
  const [batchDrafts, setBatchDrafts] = useState<BatchDraft[]>([])
  const [sessionFieldsLoaded, setSessionFieldsLoaded] = useState(false)
  // Only a brand-new session needs gear chosen here; an existing one keeps what it has.
  const [gearIds, setGearIds] = useState<GearIds | null>(null)

  if (!isExistingSession && gearIds === null && catalog && project) {
    setGearIds(defaultGearIds(catalog.cameras, catalog.telescopes, catalog.mounts, project))
  }

  if (isExistingSession && existingSession && !sessionFieldsLoaded) {
    setSessionDate(existingSession.date)
    setLocation(existingSession.location || '')
    setFilePath(existingSession.filePath || '')
    setSessionFieldsLoaded(true)
  }

  if (!projectId || !filters) return null
  if (isExistingSession && !existingSession) return null
  if (!isExistingSession && (!catalog || !gearIds)) return null
  const pid = projectId
  const allFilters = filters
  // Auto-matching from a log/filename only ever picks filters still in service.
  const filterList = filters.filter((f) => !f.retiredAt)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    setRawText(text)
  }

  function handleParse() {
    const result = parseAsiairAutorunLog(rawText)
    setParsed(result)
    setSessionDate(result.sessionDate || '')
    setBatchDrafts(draftsFromParsed(result, filterList))
  }

  function updateBatch(key: string, patch: Partial<BatchDraft>) {
    setBatchDrafts((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)))
  }

  function removeBatch(key: string) {
    setBatchDrafts((prev) => prev.filter((b) => b.key !== key))
  }

  // The log has no idea which filter was mounted or what gain/offset was
  // used - but a single sample filename from that batch's folder carries all
  // of that (plus the camera's temperature at capture), so pasting one in
  // fills the gaps the log itself can't.
  function applySampleFilename(key: string, filename: string) {
    if (!filename.trim()) return
    const parsed = parseAsiairFilename(filename)
    const patch: Partial<BatchDraft> = {}
    if (parsed.filterCode) {
      const filterId = matchFilterCode(parsed.filterCode, filterList)
      if (filterId) patch.filterId = filterId
    }
    if (parsed.gain !== undefined) patch.gain = String(parsed.gain)
    if (parsed.tempF !== undefined) patch.tempF = String(parsed.tempF)
    updateBatch(key, patch)
  }

  async function handleSave() {
    if (!sessionDate || batchDrafts.length === 0) return

    let session: Session
    if (existingSession) {
      session = {
        ...existingSession,
        date: sessionDate,
        location: location.trim() || undefined,
        filePath: filePath.trim() || existingSession.filePath,
        updatedAt: nowIso(),
      }
    } else {
      session = {
        id: newId(),
        projectId: pid,
        date: sessionDate,
        location: location.trim() || undefined,
        status: 'captured',
        filePath: filePath.trim() || undefined,
        notes: fileName ? `Imported from ASIAIR log: ${fileName}` : 'Imported from ASIAIR log',
        gear: buildSessionGear(gearIds!, catalog!.cameras, catalog!.telescopes, catalog!.mounts),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
    }
    await putDoc<Session>('sessions', session)

    const frames: Frame[] = batchDrafts.map((b) => ({
      id: newId(),
      sessionId: session.id,
      projectId: pid,
      frameType: b.frameType,
      filterId: b.filterId || undefined,
      filterName: allFilters.find((f) => f.id === b.filterId)?.description,
      count: b.count,
      exposureSeconds: b.exposureSeconds,
      gain: b.gain ? Number(b.gain) : undefined,
      offset: b.offset.trim() || undefined,
      tempF: b.tempF ? Number(b.tempF) : undefined,
      binning: b.binning || undefined,
      status: b.status,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }))
    await bulkPut<Frame>('frames', frames)

    navigate(`/projects/${projectId}/sessions/${session.id}`)
  }

  const backTo = existingSession
    ? `/projects/${projectId}/sessions/${existingSession.id}`
    : `/projects/${projectId}`

  return (
    <div>
      <Link to={backTo} className="back-link">
        &lsaquo; {existingSession ? 'Session' : project?.projectName || project?.target || 'Project'}
      </Link>
      <div className="page-header">
        <h2>Import ASIAIR log</h2>
      </div>

      <p className="muted">
        Upload or paste an ASIAIR <code>Autorun_Log_*.txt</code> file to draft
        {existingSession ? ' frame batches to add to this session' : " this session's frame batches"}{' '}
        automatically. The log can't recover which filter was mounted, or gain/offset - but a
        sample <code>.fit</code> filename from that batch's folder can, since ASIAIR encodes
        those in the filename itself - paste one into each batch below to fill in the gaps.
      </p>

      <div className="form-field">
        <label htmlFor="logFile">Upload log file</label>
        <input
          id="logFile"
          type="file"
          accept=".txt,text/plain"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
      </div>

      <div className="form-field">
        <label htmlFor="logText">...or paste the log contents</label>
        <textarea
          id="logText"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Log enabled at 2025/08/31 20:32:14&#10;2025/08/31 20:32:14 Plan 2025-08-31 Start&#10;..."
          style={{ minHeight: '8rem', fontFamily: 'monospace', fontSize: '0.8rem' }}
        />
      </div>

      <button type="button" className="btn btn-primary" onClick={handleParse} disabled={!rawText.trim()}>
        Parse log
      </button>

      {parsed && parsed.warnings.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          {parsed.warnings.map((w, i) => (
            <div className="muted" key={i}>
              {w}
            </div>
          ))}
        </div>
      )}

      {parsed && batchDrafts.length > 0 && (
        <>
          <div className="page-header" style={{ marginTop: '1.5rem' }}>
            <h2>{existingSession ? 'Session details' : 'Session'}</h2>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="sessionDate">Date</label>
              <input
                id="sessionDate"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
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
          <div className="form-field">
            <label htmlFor="filePath">File path</label>
            <input
              id="filePath"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="Where this session's files live"
            />
          </div>
          {!existingSession && catalog && gearIds && (
            <GearFields catalog={catalog} ids={gearIds} onChange={setGearIds} />
          )}

          <div className="page-header" style={{ marginTop: '1.5rem' }}>
            <h2>Frame batches ({batchDrafts.length})</h2>
          </div>

          {batchDrafts.map((b) => (
            <div className="card" key={b.key}>
              <div className="card-title-row">
                <h3>
                  {FRAME_TYPE_LABEL[b.frameType]}
                  {b.associatedTarget ? ` · pointed at ${b.associatedTarget}` : ''}
                </h3>
                <button type="button" className="icon-btn" onClick={() => removeBatch(b.key)} aria-label="Remove">
                  <IconClose />
                </button>
              </div>

              {b.count < b.plannedCount && (
                <div className="muted" style={{ marginBottom: '0.6rem' }}>
                  Completed {b.count} of {b.plannedCount} planned frames (run was interrupted).
                </div>
              )}
              {b.notes.map((note, i) => (
                <div className="muted" style={{ marginBottom: '0.6rem' }} key={i}>
                  {note}
                </div>
              ))}

              <div className="form-field">
                <label>Sample filename (optional)</label>
                <input
                  value={b.sampleFilename}
                  onChange={(e) => updateBatch(b.key, { sampleFilename: e.target.value })}
                  onBlur={(e) => applySampleFilename(b.key, e.target.value)}
                  placeholder="e.g. Light_NGC 7000_180.0s_Bin1_2600MM_H_gain100_..._0001.fit"
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                />
                <div className="muted" style={{ marginTop: '0.25rem' }}>
                  Paste one filename from this batch's folder to fill in filter, gain, and
                  temperature below.
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Frame type</label>
                  <select
                    value={b.frameType}
                    onChange={(e) => updateBatch(b.key, { frameType: e.target.value as FrameType })}
                  >
                    {FRAME_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {FRAME_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Filter</label>
                  <select value={b.filterId} onChange={(e) => updateBatch(b.key, { filterId: e.target.value })}>
                    <option value="">None</option>
                    {selectable(filters, [b.filterId]).map((f) => (
                      <option key={f.id} value={f.id}>
                        {optionLabel(f)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label># Frames</label>
                  <input
                    type="number"
                    min={0}
                    value={b.count}
                    onChange={(e) => updateBatch(b.key, { count: Number(e.target.value) })}
                  />
                </div>
                <div className="form-field">
                  <label>Exposure (sec)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={b.exposureSeconds}
                    onChange={(e) => updateBatch(b.key, { exposureSeconds: Number(e.target.value) })}
                  />
                </div>
                <div className="form-field">
                  <label>Binning</label>
                  <input value={b.binning} onChange={(e) => updateBatch(b.key, { binning: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Gain</label>
                  <input value={b.gain} onChange={(e) => updateBatch(b.key, { gain: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Offset</label>
                  <input value={b.offset} onChange={(e) => updateBatch(b.key, { offset: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Temp ({'°'}F)</label>
                  <input value={b.tempF} onChange={(e) => updateBatch(b.key, { tempF: e.target.value })} />
                </div>
              </div>

              <div className="form-field" style={{ marginBottom: 0 }}>
                <label>Status</label>
                <select
                  value={b.status}
                  onChange={(e) => updateBatch(b.key, { status: e.target.value as CaptureStatus })}
                >
                  {CAPTURE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {CAPTURE_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          <div className="form-actions">
            <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={!sessionDate}>
              {existingSession
                ? `Add ${batchDrafts.length} frame batch${batchDrafts.length > 1 ? 'es' : ''} to session`
                : `Save session & ${batchDrafts.length} frame batch${batchDrafts.length > 1 ? 'es' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
