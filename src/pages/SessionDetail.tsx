import { Link, useParams } from 'react-router-dom'
import { useCollection, useDocument } from '../firebase/firestoreDb'
import { StatusBadge } from '../components/StatusBadge'
import { formatDate, formatMinutes } from '../lib/format'
import {
  FRAME_TYPE_LABEL,
  PIPELINE_STATUS_DOT,
  PIPELINE_STATUS_LABEL,
  SESSION_STATUS_DOT,
  SESSION_STATUS_LABEL,
} from '../lib/status'
import {
  integrationMinutesForFrames,
  totalExposureSeconds,
  type FilterDef,
  type Frame,
  type Project,
  type Session,
} from '../types/models'

export function SessionDetail() {
  const { projectId, sessionId } = useParams()

  const session = useDocument<Session>('sessions', sessionId)
  const frames = useCollection<Frame>('frames', { field: 'sessionId', value: sessionId })
  const filters = useCollection<FilterDef>('filters')
  const project = useDocument<Project>('projects', projectId)

  if (!session || !frames || !filters || !projectId) return null

  const minutes = integrationMinutesForFrames(frames)

  return (
    <div>
      <Link to={`/projects/${projectId}`} className="back-link">
        &lsaquo; {project?.projectName || project?.target || 'Project'}
      </Link>
      <div className="page-header">
        <div>
          <h2>{formatDate(session.date)}</h2>
          {session.location && <div className="muted">{session.location}</div>}
        </div>
        <StatusBadge
          label={SESSION_STATUS_LABEL[session.status]}
          dot={SESSION_STATUS_DOT[session.status]}
        />
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <div className="value">{frames.length}</div>
          <div className="label">Frame batches</div>
        </div>
        <div className="stat-box">
          <div className="value">{formatMinutes(minutes)}</div>
          <div className="label">Integration time</div>
        </div>
      </div>

      {(session.filePath || session.notes) && (
        <div className="card">
          {session.filePath && (
            <div className="muted" style={{ marginBottom: session.notes ? '0.5rem' : 0 }}>
              Files: {session.filePath}
            </div>
          )}
          {session.notes && <div className="muted">{session.notes}</div>}
        </div>
      )}

      <div className="form-actions">
        <Link to={`/projects/${projectId}/sessions/${session.id}/edit`} className="btn">
          Edit session
        </Link>
        <Link to={`/projects/${projectId}/sessions/${session.id}/import`} className="btn">
          Import log
        </Link>
      </div>

      <div className="page-header" style={{ marginTop: '1.5rem' }}>
        <h2>Frames</h2>
      </div>

      {frames.length === 0 && <div className="empty-state">No frames logged for this session yet.</div>}

      {frames.map((frame) => {
        const filter = filters.find((f) => f.id === frame.filterId)
        return (
          <Link
            to={`/projects/${projectId}/sessions/${session.id}/frames/${frame.id}`}
            className="card-link"
            key={frame.id}
          >
            <div className="card">
              <div className="card-title-row">
                <h3>
                  {FRAME_TYPE_LABEL[frame.frameType]}
                  {filter ? ` · ${filter.description}` : ''}
                </h3>
                <StatusBadge
                  label={PIPELINE_STATUS_LABEL[frame.status]}
                  dot={PIPELINE_STATUS_DOT[frame.status]}
                />
              </div>
              <div className="muted">
                {frame.count} &times; {frame.exposureSeconds}s
                {frame.binning ? ` · Bin ${frame.binning}` : ''}
                {` · ${formatMinutes(totalExposureSeconds(frame) / 60)}`}
              </div>
            </div>
          </Link>
        )
      })}

      <Link
        to={`/projects/${projectId}/sessions/${session.id}/frames/new`}
        className="fab"
        aria-label="New frame batch"
      >
        +
      </Link>
    </div>
  )
}
