import { Link, useNavigate, useParams } from 'react-router-dom'
import { removeDoc, removeWhere, useCollection, useDocument } from '../firebase/firestoreDb'
import { StatusBadge } from '../components/StatusBadge'
import { formatDate, formatMinutes } from '../lib/format'
import {
  PROJECT_STATUS_DOT,
  PROJECT_STATUS_LABEL,
  SESSION_STATUS_DOT,
  SESSION_STATUS_LABEL,
} from '../lib/status'
import {
  integrationMinutesForFrames,
  totalExposureSeconds,
  type Camera,
  type FilterDef,
  type Frame,
  type Mount,
  type Project,
  type Session,
  type Telescope,
} from '../types/models'

export function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const project = useDocument<Project>('projects', id)
  const sessions = useCollection<Session>('sessions', { field: 'projectId', value: id })
  const frames = useCollection<Frame>('frames', { field: 'projectId', value: id })
  const filters = useCollection<FilterDef>('filters')
  const camera = useDocument<Camera>('cameras', project?.cameraId)
  const telescope = useDocument<Telescope>('telescopes', project?.telescopeId)
  const mount = useDocument<Mount>('mounts', project?.mountId)

  if (!project || !sessions || !frames || !filters) return null

  const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  const totalMinutes = integrationMinutesForFrames(frames)

  const minutesByFilter = new Map<string, number>()
  for (const frame of frames) {
    if (frame.frameType !== 'light' || !frame.filterId) continue
    const minutes = totalExposureSeconds(frame) / 60
    minutesByFilter.set(frame.filterId, (minutesByFilter.get(frame.filterId) || 0) + minutes)
  }

  const plannedFilters = filters.filter((f) => project.filterIds.includes(f.id))

  async function handleDelete() {
    if (!project) return
    if (!confirm(`Delete "${project.projectName || project.target}" and all its sessions?`)) return
    await removeWhere<Frame>('frames', 'projectId', project.id)
    await removeWhere<Session>('sessions', 'projectId', project.id)
    await removeDoc('projects', project.id)
    navigate('/projects')
  }

  return (
    <div>
      <Link to="/projects" className="back-link">
        &lsaquo; Projects
      </Link>
      <div className="page-header">
        <div>
          <h2>{project.projectName || project.target}</h2>
          {project.projectName && <div className="muted">{project.target}</div>}
        </div>
        <StatusBadge
          label={PROJECT_STATUS_LABEL[project.status]}
          dot={PROJECT_STATUS_DOT[project.status]}
        />
      </div>

      <div className="muted" style={{ marginBottom: '0.75rem' }}>
        {[project.location, camera?.description, telescope?.description, mount?.description]
          .filter(Boolean)
          .join(' · ')}
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <div className="value">{sessions.length}</div>
          <div className="label">Sessions</div>
        </div>
        <div className="stat-box">
          <div className="value">{formatMinutes(totalMinutes)}</div>
          <div className="label">Total integration{project.goalHours ? ` / ${project.goalHours}h goal` : ''}</div>
        </div>
      </div>

      {minutesByFilter.size > 0 && (
        <div className="card">
          {[...minutesByFilter.entries()].map(([filterId, minutes]) => {
            const filter = filters.find((f) => f.id === filterId)
            return (
              <div className="list-item" key={filterId}>
                <span>{filter?.description || 'Unknown filter'}</span>
                <span className="muted">{formatMinutes(minutes)}</span>
              </div>
            )
          })}
        </div>
      )}

      {(plannedFilters.length > 0 || project.storageRoot || project.notes) && (
        <div className="card">
          {plannedFilters.length > 0 && (
            <div className="muted" style={{ marginBottom: project.storageRoot || project.notes ? '0.5rem' : 0 }}>
              Planned filters: {plannedFilters.map((f) => f.description).join(', ')}
            </div>
          )}
          {project.storageRoot && (
            <div className="muted" style={{ marginBottom: project.notes ? '0.5rem' : 0 }}>
              Storage: {project.storageRoot}
            </div>
          )}
          {project.notes && <div className="muted">{project.notes}</div>}
        </div>
      )}

      <div className="form-actions">
        <Link to={`/projects/${project.id}/edit`} className="btn">
          Edit project
        </Link>
        <button className="btn btn-danger" onClick={handleDelete}>
          Delete
        </button>
      </div>

      <div className="page-header" style={{ marginTop: '1.5rem' }}>
        <h2>Sessions</h2>
        <Link to={`/projects/${project.id}/sessions/import`} className="btn btn-sm">
          Import log
        </Link>
      </div>

      {sortedSessions.length === 0 && (
        <div className="empty-state">No sessions logged yet.</div>
      )}

      {sortedSessions.map((session) => {
        const sessionFrames = frames.filter((f) => f.sessionId === session.id)
        const minutes = integrationMinutesForFrames(sessionFrames)
        return (
          <Link
            to={`/projects/${project.id}/sessions/${session.id}`}
            className="card-link"
            key={session.id}
          >
            <div className="card">
              <div className="card-title-row">
                <h3>{formatDate(session.date)}</h3>
                <StatusBadge
                  label={SESSION_STATUS_LABEL[session.status]}
                  dot={SESSION_STATUS_DOT[session.status]}
                />
              </div>
              <div className="muted">
                {session.location || 'No location set'}
                {sessionFrames.length > 0 &&
                  ` · ${formatMinutes(minutes)} · ${sessionFrames.length} frame batch${sessionFrames.length > 1 ? 'es' : ''}`}
              </div>
            </div>
          </Link>
        )
      })}

      <Link to={`/projects/${project.id}/sessions/new`} className="fab" aria-label="New session">
        +
      </Link>
    </div>
  )
}
