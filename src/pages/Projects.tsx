import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { StatusBadge } from '../components/StatusBadge'

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
              <h3>{project.title || project.target}</h3>
              <StatusBadge status={project.status} />
            </div>
            {project.goal && <div className="muted">{project.goal}</div>}
          </div>
        </Link>
      ))}

      <Link to="/projects/new" className="fab" aria-label="New project">
        +
      </Link>
    </div>
  )
}
