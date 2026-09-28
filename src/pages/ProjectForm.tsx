import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso } from '../db/db'
import { PROJECT_STATUSES, type Project, type ProjectStatus } from '../types/models'
import { STATUS_LABEL } from '../lib/status'

export function ProjectForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const existing = useLiveQuery(
    () => (id ? db.projects.get(id) : undefined),
    [id],
  )

  const [target, setTarget] = useState('')
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [notes, setNotes] = useState('')
  const [loaded, setLoaded] = useState(false)

  if (isEdit && existing && !loaded) {
    setTarget(existing.target)
    setTitle(existing.title || '')
    setGoal(existing.goal || '')
    setStatus(existing.status)
    setNotes(existing.notes || '')
    setLoaded(true)
  }

  if (isEdit && !existing) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target.trim()) return

    if (isEdit && existing) {
      const updated: Project = {
        ...existing,
        target: target.trim(),
        title: title.trim() || undefined,
        goal: goal.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
        updatedAt: nowIso(),
      }
      await db.projects.put(updated)
      navigate(`/projects/${existing.id}`)
    } else {
      const project: Project = {
        id: newId(),
        target: target.trim(),
        title: title.trim() || undefined,
        goal: goal.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      await db.projects.add(project)
      navigate(`/projects/${project.id}`)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>{isEdit ? 'Edit project' : 'New project'}</h2>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="target">Target *</label>
          <input
            id="target"
            placeholder="e.g. M31 - Andromeda Galaxy"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="title">Project name (optional)</label>
          <input
            id="title"
            placeholder="Defaults to target name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="goal">Goal</label>
          <input
            id="goal"
            placeholder="e.g. HaRGB mosaic, 20+ hours"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-block">
            {isEdit ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  )
}
