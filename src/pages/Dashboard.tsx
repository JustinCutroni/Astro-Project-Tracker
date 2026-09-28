import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { StatusBadge } from '../components/StatusBadge'
import { formatMinutes } from '../lib/format'
import { PROJECT_STATUS_DOT, PROJECT_STATUS_LABEL } from '../lib/status'
import { integrationMinutesForFrames } from '../types/models'

export function Dashboard() {
  const projects = useLiveQuery(() => db.projects.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const frames = useLiveQuery(() => db.frames.toArray(), [])

  if (!projects || !sessions || !frames) return null

  const activeProjects = projects.filter(
    (p) => p.status !== 'complete',
  )
  const totalMinutes = integrationMinutesForFrames(frames)

  const recentSessions = [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-box">
          <div className="value">{activeProjects.length}</div>
          <div className="label">Active projects</div>
        </div>
        <div className="stat-box">
          <div className="value">{sessions.length}</div>
          <div className="label">Sessions logged</div>
        </div>
        <div className="stat-box">
          <div className="value">{formatMinutes(totalMinutes)}</div>
          <div className="label">Total integration time</div>
        </div>
        <div className="stat-box">
          <div className="value">{projects.length}</div>
          <div className="label">All-time projects</div>
        </div>
      </div>

      <div className="page-header">
        <h2>Active projects</h2>
        <Link to="/projects" className="muted">
          See all
        </Link>
      </div>

      {activeProjects.length === 0 && (
        <div className="empty-state">
          No active projects yet.
          <br />
          <Link to="/projects/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Start a project
          </Link>
        </div>
      )}

      {activeProjects.map((project) => (
        <Link to={`/projects/${project.id}`} className="card-link" key={project.id}>
          <div className="card">
            <div className="card-title-row">
              <h3>{project.projectName || project.target}</h3>
              <StatusBadge
                label={PROJECT_STATUS_LABEL[project.status]}
                dot={PROJECT_STATUS_DOT[project.status]}
              />
            </div>
            {project.location && <div className="muted">{project.location}</div>}
          </div>
        </Link>
      ))}

      {recentSessions.length > 0 && (
        <>
          <div className="page-header" style={{ marginTop: '1.5rem' }}>
            <h2>Recent sessions</h2>
          </div>
          <div className="card">
            {recentSessions.map((session) => {
              const project = projects.find((p) => p.id === session.projectId)
              return (
                <div className="list-item" key={session.id}>
                  <span>{project?.projectName || project?.target || 'Unknown project'}</span>
                  <span className="muted">{session.date}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
