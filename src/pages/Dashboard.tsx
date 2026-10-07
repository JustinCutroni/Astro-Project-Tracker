import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCollection } from '../firebase/firestoreDb'
import { PipelineProgress } from '../components/PipelineProgress'
import { StatusBadge } from '../components/StatusBadge'
import { daysSince, formatMinutes, relativeDayLabel, today } from '../lib/format'
import { pipelineProgress, STATUS_DOT, STATUS_LABEL } from '../lib/status'
import {
  integrationMinutesForFrames,
  plannedIntegrationMinutesForFrames,
  type Frame,
  type Project,
  type Session,
} from '../types/models'

export function Dashboard() {
  const navigate = useNavigate()
  const projects = useCollection<Project>('projects')
  const sessions = useCollection<Session>('sessions')
  const frames = useCollection<Frame>('frames')
  const [planProjectId, setPlanProjectId] = useState('')

  if (!projects || !sessions || !frames) return null

  const activeProjects = projects.filter(
    (p) => p.status !== 'complete',
  )
  const totalMinutes = integrationMinutesForFrames(frames)
  const todayDate = today()

  const tonightSessions = sessions.filter((s) => s.date === todayDate)
  const upcomingSessions = [...sessions]
    .filter((s) => s.date >= todayDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  // Sessions are dated by when the capture happens, so a session planned for
  // next week isn't "recent" yet. Today stays in Upcoming, keeping the two
  // lists from overlapping.
  const recentSessions = [...sessions]
    .filter((s) => s.date < todayDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  function handlePlanTonight() {
    if (planProjectId) navigate(`/projects/${planProjectId}/sessions/new`)
  }

  return (
    <div>
      {tonightSessions.length === 1 && (
        <Link
          to={`/projects/${tonightSessions[0].projectId}/sessions/${tonightSessions[0].id}`}
          className="card-link"
        >
          <div className="card" style={{ borderColor: 'var(--accent)' }}>
            <div className="card-title-row">
              <h3>Tonight</h3>
            </div>
            <div className="muted">
              {projects.find((p) => p.id === tonightSessions[0].projectId)?.projectName ||
                projects.find((p) => p.id === tonightSessions[0].projectId)?.target ||
                'Unknown project'}
              {tonightSessions[0].location ? ` · ${tonightSessions[0].location}` : ''}
            </div>
          </div>
        </Link>
      )}

      {tonightSessions.length > 1 && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="card-title-row">
            <h3>Tonight</h3>
          </div>
          {tonightSessions.map((session) => {
            const project = projects.find((p) => p.id === session.projectId)
            return (
              <Link
                to={`/projects/${session.projectId}/sessions/${session.id}`}
                className="list-item"
                key={session.id}
              >
                <span>{project?.projectName || project?.target || 'Unknown project'}</span>
                <span className="muted">{session.location || ''}</span>
              </Link>
            )
          })}
        </div>
      )}

      {tonightSessions.length === 0 && activeProjects.length > 0 && (
        <div className="card">
          <div className="card-title-row">
            <h3>Tonight</h3>
          </div>
          <div className="muted" style={{ marginBottom: '0.6rem' }}>
            No session planned yet.
          </div>
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-field">
              <label htmlFor="planProject">Project</label>
              <select
                id="planProject"
                value={planProjectId}
                onChange={(e) => setPlanProjectId(e.target.value)}
              >
                <option value="">Choose a project</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectName || p.target}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!planProjectId}
              onClick={handlePlanTonight}
            >
              Plan session
            </button>
          </div>
        </div>
      )}

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
        // Only past/today sessions count as a "capture" - a session
        // scheduled for next week isn't one yet, and would otherwise show
        // up as a negative "days since".
        const lastCaptureDate = projectSessions
          .map((s) => s.date)
          .filter((d) => d <= todayDate)
          .sort()
          .at(-1)
        const projectFrames = frames.filter((f) => f.projectId === project.id)
        const capturedMinutes = integrationMinutesForFrames(projectFrames)
        const plannedMinutes = plannedIntegrationMinutesForFrames(projectFrames)
        const percentDone =
          plannedMinutes > 0
            ? Math.min(100, Math.round((capturedMinutes / plannedMinutes) * 100))
            : undefined
        const overall = pipelineProgress(project, projectFrames)

        return (
          <Link to={`/projects/${project.id}`} className="card-link" key={project.id}>
            <div className="card">
              <div className="card-title-row">
                <h3>{project.projectName || project.target}</h3>
                <StatusBadge
                  label={STATUS_LABEL[project.status]}
                  dot={STATUS_DOT[project.status]}
                />
              </div>
              <div className="muted">
                {lastCaptureDate
                  ? `${daysSince(lastCaptureDate)} day${daysSince(lastCaptureDate) === 1 ? '' : 's'} since last capture`
                  : 'No sessions yet'}
              </div>
              <div className="muted" style={{ marginTop: '0.4rem' }}>
                {formatMinutes(capturedMinutes)} captured / {formatMinutes(plannedMinutes)} planned
                {percentDone !== undefined ? ` · ${percentDone}% captured` : ''}
              </div>
              <PipelineProgress percent={overall} status={project.status} />
            </div>
          </Link>
        )
      })}

      {upcomingSessions.length > 0 && (
        <>
          <div className="page-header" style={{ marginTop: '1.5rem' }}>
            <h2>Upcoming sessions</h2>
          </div>
          <div className="card">
            {upcomingSessions.map((session) => {
              const project = projects.find((p) => p.id === session.projectId)
              return (
                <Link
                  to={`/projects/${session.projectId}/sessions/${session.id}`}
                  className="list-item"
                  key={session.id}
                >
                  <span>{project?.projectName || project?.target || 'Unknown project'}</span>
                  <span className="muted">{relativeDayLabel(session.date)}</span>
                </Link>
              )
            })}
          </div>
        </>
      )}

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
