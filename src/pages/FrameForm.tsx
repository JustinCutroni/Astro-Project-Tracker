import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { putDoc, removeDoc, useCollection, useDocument } from '../firebase/firestoreDb'
import { newId, nowIso } from '../lib/ids'
import { FRAME_TYPES, PIPELINE_STATUSES, type FilterDef, type Frame, type FrameType, type PipelineStatus } from '../types/models'
import { FRAME_TYPE_LABEL, PIPELINE_STATUS_LABEL } from '../lib/status'

export function FrameForm() {
  const { projectId, sessionId, frameId } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(frameId)

  const existing = useDocument<Frame>('frames', frameId)
  const filtersRaw = useCollection<FilterDef>('filters')
  const filters = filtersRaw && [...filtersRaw].sort((a, b) => a.description.localeCompare(b.description))

  const [frameType, setFrameType] = useState<FrameType>('light')
  const [filterId, setFilterId] = useState('')
  const [count, setCount] = useState(1)
  const [exposureSeconds, setExposureSeconds] = useState(300)
  const [gain, setGain] = useState('')
  const [offset, setOffset] = useState('')
  const [tempF, setTempF] = useState('')
  const [binning, setBinning] = useState('1x1')
  const [status, setStatus] = useState<PipelineStatus>('captured')
  const [filePathPattern, setFilePathPattern] = useState('')
  const [notes, setNotes] = useState('')
  const [loaded, setLoaded] = useState(false)

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

  if (isEdit && !existing) return null
  if (!filters || !projectId || !sessionId) return null

  const totalSeconds = count * exposureSeconds

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const base = {
      projectId: projectId!,
      sessionId: sessionId!,
      frameType,
      filterId: filterId || undefined,
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

    if (isEdit && existing) {
      await putDoc<Frame>('frames', { ...existing, ...base })
    } else {
      const frame: Frame = { id: newId(), createdAt: nowIso(), ...base }
      await putDoc<Frame>('frames', frame)
    }
    navigate(`/projects/${projectId}/sessions/${sessionId}`)
  }

  async function handleDelete() {
    if (!existing) return
    if (!confirm('Delete this frame batch?')) return
    await removeDoc('frames', existing.id)
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
              onChange={(e) => setStatus(e.target.value as PipelineStatus)}
            >
              {PIPELINE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PIPELINE_STATUS_LABEL[s]}
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
