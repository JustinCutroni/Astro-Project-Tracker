import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { StatusBadge } from '../components/StatusBadge'
import { formatDate, formatMinutes } from '../lib/format'
import { integrationMinutesForSession } from '../types/models'

export function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const project = useLiveQuery(() => (id ? db.projects.get(id) : undefined), [id])
  const sessions = useLiveQuery(
    () => (id ? db.sessions.where('projectId').equals(id).toArray() : []),
    [id],
  )
  const locations = useLiveQuery(() => db.locations.orderBy('name').toArray(), [])
  const filters = useLiveQuery(() => db.filters.orderBy('name').toArray(), [])

  if (!project || !sessions || !locations || !filters) return null

  const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  const totalMinutes = sessions.reduce(
    (sum, s) => sum + integrationMinutesForSession(s),
    0,
  )

  const minutesByFilter = new Map<string, number>()
  for (const session of sessions) {
    for (const exp of session.exposures) {
      const minutes = (exp.subExposureSeconds * exp.subCount) / 60
      minutesByFilter.set(exp.filterId, (minutesByFilter.get(exp.filterId) || 0) + minutes)
    }
  }

  async function handleDelete() {
    if (!project) return
    if (!confirm(`Delete "${project.title || project.target}" and all its sessions?`)) return
    await db.sessions.where('projectId').equals(project.id).delete()
    await db.projects.delete(project.id)
    navigate('/projects')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{project.title || project.target}</h2>
          {project.title && <div className="muted">{project.target}</div>}
        </div>
        <StatusBadge status={project.status} />
      </div>

      {project.goal && <p>{project.goal}</p>}

      <div className="stat-grid">
        <div className="stat-box">
          <div className="value">{sessions.length}</div>
          <div className="label">Sessions</div>
        </div>
        <div className="stat-box">
          <div className="value">{formatMinutes(totalMinutes)}</div>
          <div className="label">Total integration</div>
        </div>
      </div>

      {minutesByFilter.size > 0 && (
        <div className="card">
          {[...minutesByFilter.entries()].map(([filterId, minutes]) => {
            const filter = filters.find((f) => f.id === filterId)
            return (
              <div className="list-item" key={filterId}>
                <span>{filter?.name || 'Unknown filter'}</span>
                <span className="muted">{formatMinutes(minutes)}</span>
              </div>
            )
          })}
        </div>
      )}

      {project.notes && (
        <div className="card">
          <div className="muted">{project.notes}</div>
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
      </div>

      {sortedSessions.length === 0 && (
        <div className="empty-state">No sessions logged yet.</div>
      )}

      {sortedSessions.map((session) => {
        const location = locations.find((l) => l.id === session.locationId)
        const minutes = integrationMinutesForSession(session)
        return (
          <Link
            to={`/projects/${project.id}/sessions/${session.id}`}
            className="card-link"
            key={session.id}
          >
            <div className="card">
              <div className="card-title-row">
                <h3>{formatDate(session.date)}</h3>
                <span className="muted">{formatMinutes(minutes)}</span>
              </div>
              <div className="muted">
                {location?.name || 'No location set'}
                {session.exposures.length > 0 &&
                  ` · ${session.exposures.length} filter${session.exposures.length > 1 ? 's' : ''}`}
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
