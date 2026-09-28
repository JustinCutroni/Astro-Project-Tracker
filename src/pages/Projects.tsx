import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { StatusBadge } from '../components/StatusBadge'
import { PROJECT_STATUS_DOT, PROJECT_STATUS_LABEL } from '../lib/status'

export function Projects() {
  const projects = useLiveQuery(
    () => db.projects.orderBy('updatedAt').reverse().toArray(),
    [],
  )

  if (!projects) return null

  return (
    <div>
      <div className="page-header">
        <h2>Projects</h2>
      </div>

      {projects.length === 0 && (
        <div className="empty-state">No projects yet. Tap + to start one.</div>
      )}

      {projects.map((project) => (
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

      <Link to="/projects/new" className="fab" aria-label="New project">
        +
      </Link>
    </div>
  )
}
