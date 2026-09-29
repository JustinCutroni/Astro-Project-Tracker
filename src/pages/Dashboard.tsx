import { Link } from 'react-router-dom'
import { useCollection } from '../firebase/firestoreDb'
import { StatusBadge } from '../components/StatusBadge'
import { daysSince, formatMinutes, parseGoalHours } from '../lib/format'
import { PROJECT_STATUS_DOT, PROJECT_STATUS_LABEL } from '../lib/status'
import { integrationMinutesForFrames, type Frame, type Project, type Session } from '../types/models'

export function Dashboard() {
  const projects = useCollection<Project>('projects')
  const sessions = useCollection<Session>('sessions')
  const frames = useCollection<Frame>('frames')

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

      {activeProjects.map((project) => {
        const projectSessions = sessions.filter((s) => s.projectId === project.id)
        const lastSessionDate = projectSessions
          .map((s) => s.date)
          .sort()
          .at(-1)
        const projectFrames = frames.filter((f) => f.projectId === project.id)
        const capturedMinutes = integrationMinutesForFrames(projectFrames)
        const goalHours = parseGoalHours(project.goalHours)
        const percentDone = goalHours
          ? Math.min(100, Math.round((capturedMinutes / 60 / goalHours) * 100))
          : undefined

        return (
          <Link to={`/projects/${project.id}`} className="card-link" key={project.id}>
            <div className="card">
              <div className="card-title-row">
                <h3>{project.projectName || project.target}</h3>
                <StatusBadge
                  label={PROJECT_STATUS_LABEL[project.status]}
                  dot={PROJECT_STATUS_DOT[project.status]}
                />
              </div>
              <div className="muted">
                {project.location}
                {project.location ? ' · ' : ''}
                {lastSessionDate
                  ? `${daysSince(lastSessionDate)} day${daysSince(lastSessionDate) === 1 ? '' : 's'} since last capture`
                  : 'No sessions yet'}
              </div>
              <div className="muted" style={{ marginTop: '0.4rem' }}>
                {formatMinutes(capturedMinutes)}
                {goalHours ? ` / ${project.goalHours}h` : ''} light integration
                {percentDone !== undefined ? ` · ${percentDone}%` : ''}
              </div>
              {percentDone !== undefined && (
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${percentDone}%` }} />
                </div>
              )}
            </div>
          </Link>
        )
      })}

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
