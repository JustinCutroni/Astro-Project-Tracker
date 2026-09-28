import { Link } from 'react-router-dom'
import { useCollection } from '../firebase/firestoreDb'
import { StatusBadge } from '../components/StatusBadge'
import { PROJECT_STATUS_DOT, PROJECT_STATUS_LABEL } from '../lib/status'
import type { Project } from '../types/models'

export function Projects() {
  const projectsRaw = useCollection<Project>('projects')
  const projects = projectsRaw && [...projectsRaw].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

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
