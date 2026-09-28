import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso } from '../db/db'
import { parseAsiairAutorunLog, type ParsedAsiairLog } from '../lib/asiairLogParser'
import { FRAME_TYPES, PIPELINE_STATUSES, type Frame, type FrameType, type PipelineStatus, type Session } from '../types/models'
import { FRAME_TYPE_LABEL, PIPELINE_STATUS_LABEL } from '../lib/status'
import { useKnownLocations } from '../lib/locations'
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
  status: PipelineStatus
  plannedCount: number
  associatedTarget?: string
}

function draftsFromParsed(parsed: ParsedAsiairLog): BatchDraft[] {
  return parsed.batches.map((b, i) => ({
    key: `${i}-${newId()}`,
    frameType: b.frameType,
    filterId: '',
    count: b.actualCount,
    exposureSeconds: b.exposureSeconds,
    gain: '',
    offset: '',
    tempF: b.tempF !== undefined ? String(b.tempF) : '',
    binning: b.binning,
    status: 'captured',
    plannedCount: b.plannedCount,
    associatedTarget: b.associatedTarget,
  }))
}

export function ImportSessionLog() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId])
  const filters = useLiveQuery(() => db.filters.orderBy('description').toArray(), [])
  const knownLocations = useKnownLocations()

  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedAsiairLog | null>(null)
  const [fileName, setFileName] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [location, setLocation] = useState('')
  const [filePath, setFilePath] = useState('')
  const [batchDrafts, setBatchDrafts] = useState<BatchDraft[]>([])

  if (!projectId || !filters) return null
  const pid = projectId

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
    setBatchDrafts(draftsFromParsed(result))
  }

  function updateBatch(key: string, patch: Partial<BatchDraft>) {
    setBatchDrafts((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)))
  }

  function removeBatch(key: string) {
    setBatchDrafts((prev) => prev.filter((b) => b.key !== key))
  }

  async function handleSave() {
    if (!sessionDate || batchDrafts.length === 0) return

    const session: Session = {
      id: newId(),
      projectId: pid,
      date: sessionDate,
      location: location.trim() || undefined,
      status: 'captured',
      filePath: filePath.trim() || undefined,
      notes: fileName ? `Imported from ASIAIR log: ${fileName}` : 'Imported from ASIAIR log',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await db.sessions.add(session)

    const frames: Frame[] = batchDrafts.map((b) => ({
      id: newId(),
      sessionId: session.id,
      projectId: pid,
      frameType: b.frameType,
      filterId: b.filterId || undefined,
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
    await db.frames.bulkAdd(frames)

    navigate(`/projects/${projectId}/sessions/${session.id}`)
  }

  return (
    <div>
      <Link to={`/projects/${projectId}`} className="back-link">
        &lsaquo; {project?.projectName || project?.target || 'Project'}
      </Link>
      <div className="page-header">
        <h2>Import ASIAIR log</h2>
      </div>

      <p className="muted">
        Upload or paste an ASIAIR <code>Autorun_Log_*.txt</code> file to draft this session's
        frame batches automatically. It can't recover which filter was mounted, or gain/offset -
        those aren't in the log - so double-check those fields below before saving.
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
            <h2>Session</h2>
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

              {b.count !== b.plannedCount && (
                <div className="muted" style={{ marginBottom: '0.6rem' }}>
                  Completed {b.count} of {b.plannedCount} planned frames (run was interrupted).
                </div>
              )}

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
                    {filters.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.description}
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
                  onChange={(e) => updateBatch(b.key, { status: e.target.value as PipelineStatus })}
                >
                  {PIPELINE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PIPELINE_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          <div className="form-actions">
            <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={!sessionDate}>
              Save session &amp; {batchDrafts.length} frame batch{batchDrafts.length > 1 ? 'es' : ''}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
