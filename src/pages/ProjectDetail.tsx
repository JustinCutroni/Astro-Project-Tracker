import { Link, useNavigate, useParams } from 'react-router-dom'
import { removeDoc, removeWhere, useCollection, useDocument } from '../firebase/firestoreDb'
import { StatusBadge } from '../components/StatusBadge'
import { daysSince, formatDate, formatMinutes, parseGoalHours, today } from '../lib/format'
import {
  STATUS_DOT,
  STATUS_LABEL,
} from '../lib/status'
import {
  integrationMinutesForFrames,
  totalExposureSeconds,
  type FilterDef,
  type Frame,
  type Project,
  type Session,
} from '../types/models'
import { sortFilters } from '../lib/filters'

export function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const project = useDocument<Project>('projects', id)
  const sessions = useCollection<Session>('sessions', { field: 'projectId', value: id })
  const frames = useCollection<Frame>('frames', { field: 'projectId', value: id })
  const filtersRaw = useCollection<FilterDef>('filters')

  if (!project || !sessions || !frames || !filtersRaw) return null
  const filters = sortFilters(filtersRaw)

  const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  const totalMinutes = integrationMinutesForFrames(frames)
  // Only past/today sessions count as a "capture" - a session scheduled
  // for next week isn't one yet, and would otherwise show a negative
  // "days since".
  const lastCaptureDate = sortedSessions.find((s) => s.date <= today())?.date
  const goalHours = parseGoalHours(project.goalHours)
  const percentDone = goalHours
    ? Math.min(100, Math.round((totalMinutes / 60 / goalHours) * 100))
    : undefined

  const minutesByFilter = new Map<string, number>()
  for (const frame of frames) {
    if (frame.frameType !== 'light' || frame.status === 'planning' || !frame.filterId) continue
    const minutes = totalExposureSeconds(frame) / 60
    minutesByFilter.set(frame.filterId, (minutesByFilter.get(frame.filterId) || 0) + minutes)
  }

  // One row per filter with light time, in catalog order. A filter that's no
  // longer in the catalog still gets a row, named from the batches themselves.
  const filterRows = [
    ...filters.filter((f) => minutesByFilter.has(f.id)).map((f) => ({ id: f.id, name: f.description })),
    ...[...minutesByFilter.keys()]
      .filter((id) => !filters.some((f) => f.id === id))
      .map((id) => ({
        id,
        name: frames.find((fr) => fr.filterId === id)?.filterName ?? 'Unknown filter',
      })),
  ].map((row) => ({ ...row, minutes: minutesByFilter.get(row.id)! }))

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
          label={STATUS_LABEL[project.status]}
          dot={STATUS_DOT[project.status]}
        />
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

      <div className="muted" style={{ marginBottom: percentDone !== undefined ? '0.3rem' : '0.75rem' }}>
        {lastCaptureDate
          ? `${daysSince(lastCaptureDate)} day${daysSince(lastCaptureDate) === 1 ? '' : 's'} since last capture`
          : 'No sessions yet'}
        {percentDone !== undefined && ` · ${percentDone}% of light integration goal`}
      </div>
      {percentDone !== undefined && (
        <div className="progress-track" style={{ marginBottom: '0.75rem' }}>
          <div className="progress-fill" style={{ width: `${percentDone}%` }} />
        </div>
      )}

      {minutesByFilter.size > 0 && (
        <div className="card">
          {filterRows.map((row) => (
            <div className="list-item" key={row.id}>
              <span>{row.name}</span>
              <span className="muted">{formatMinutes(row.minutes)}</span>
            </div>
          ))}
        </div>
      )}

      {project.notes && (
        <div className="card">
          <div className="muted">{project.notes}</div>
        </div>
      )}

      <div className="muted" style={{ marginBottom: '0.75rem' }}>
        Created {formatDate(project.createdAt)}
        {project.updatedAt !== project.createdAt ? ` · Updated ${formatDate(project.updatedAt)}` : ''}
      </div>

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
                  label={STATUS_LABEL[session.status]}
                  dot={STATUS_DOT[session.status]}
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
