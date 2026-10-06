import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCollection, useDocument } from '../firebase/firestoreDb'
import { StatusBadge } from '../components/StatusBadge'
import { formatDate, formatMinutes } from '../lib/format'
import { CAPTURE_STATUS_DOT, CAPTURE_STATUS_LABEL, FRAME_TYPE_LABEL } from '../lib/status'
import { sortFilters } from '../lib/filters'
import { frameFilterName, optionLabel, selectable, useGearCatalog } from '../lib/gear'
import { GearList } from '../components/GearList'
import {
  FRAME_TYPES,
  integrationMinutesForFrames,
  totalExposureSeconds,
  type FilterDef,
  type Frame,
  type FrameType,
  type Project,
  type Session,
} from '../types/models'

type SortBy = 'type' | 'filter' | 'newest'

export function SessionDetail() {
  const { projectId, sessionId } = useParams()

  const session = useDocument<Session>('sessions', sessionId)
  const frames = useCollection<Frame>('frames', { field: 'sessionId', value: sessionId })
  const filtersRaw = useCollection<FilterDef>('filters')
  const project = useDocument<Project>('projects', projectId)
  const catalog = useGearCatalog()

  const [typeFilter, setTypeFilter] = useState<FrameType | 'all'>('all')
  const [filterIdFilter, setFilterIdFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortBy>('type')

  if (!session || !frames || !filtersRaw || !projectId) return null
  const filters = sortFilters(filtersRaw)

  const gear = session.gear
  const retiredIds = new Set(
    [...(catalog?.cameras ?? []), ...(catalog?.telescopes ?? []), ...(catalog?.mounts ?? []), ...(catalog?.filters ?? [])]
      .filter((g) => g.retiredAt)
      .map((g) => g.id),
  )

  const minutes = integrationMinutesForFrames(frames)

  const filterOrder = new Map(filters.map((f, i) => [f.id, i]))
  const filterRank = (f: Frame) => (f.filterId ? (filterOrder.get(f.filterId) ?? filters.length) : Infinity)
  const typeRank = (f: Frame) => FRAME_TYPES.indexOf(f.frameType)

  const visibleFrames = frames
    .filter((f) => typeFilter === 'all' || f.frameType === typeFilter)
    .filter((f) => {
      if (filterIdFilter === 'all') return true
      if (filterIdFilter === 'none') return !f.filterId
      return f.filterId === filterIdFilter
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return b.createdAt.localeCompare(a.createdAt)
      if (sortBy === 'filter') return filterRank(a) - filterRank(b) || typeRank(a) - typeRank(b)
      return typeRank(a) - typeRank(b) || filterRank(a) - filterRank(b)
    })

  return (
    <div>
      <Link to={`/projects/${projectId}`} className="back-link">
        &lsaquo; {project?.projectName || project?.target || 'Project'}
      </Link>
      <div className="page-header">
        <div>
          <h2>{formatDate(session.date)}</h2>
          {session.location && <div className="muted">{session.location}</div>}
        </div>
        <StatusBadge
          label={CAPTURE_STATUS_LABEL[session.status]}
          dot={CAPTURE_STATUS_DOT[session.status]}
        />
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <div className="value">{frames.length}</div>
          <div className="label">Frame batches</div>
        </div>
        <div className="stat-box">
          <div className="value">{formatMinutes(minutes)}</div>
          <div className="label">Integration time</div>
        </div>
      </div>

      {gear && (
        <GearList
          camera={gear.camera}
          telescope={gear.telescope}
          mount={gear.mount}
          filters={gear.filters}
          retiredIds={retiredIds}
        />
      )}

      {(session.filePath || session.notes) && (
        <div className="card">
          {session.filePath && (
            <div className="muted" style={{ marginBottom: session.notes ? '0.5rem' : 0 }}>
              Files: {session.filePath}
            </div>
          )}
          {session.notes && <div className="muted">{session.notes}</div>}
        </div>
      )}

      <div className="form-actions">
        <Link to={`/projects/${projectId}/sessions/${session.id}/edit`} className="btn">
          Edit session
        </Link>
        <Link to={`/projects/${projectId}/sessions/${session.id}/import`} className="btn">
          Import log
        </Link>
        <Link to={`/projects/${projectId}/sessions/${session.id}/copy`} className="btn">
          Copy session
        </Link>
      </div>

      <div className="page-header" style={{ marginTop: '1.5rem' }}>
        <h2>Frames</h2>
      </div>

      {frames.length === 0 && <div className="empty-state">No frames logged for this session yet.</div>}

      {frames.length > 0 && (
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="frameTypeFilter">Type</label>
            <select
              id="frameTypeFilter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as FrameType | 'all')}
            >
              <option value="all">All</option>
              {FRAME_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FRAME_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="frameFilterFilter">Filter</label>
            <select
              id="frameFilterFilter"
              value={filterIdFilter}
              onChange={(e) => setFilterIdFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="none">None</option>
              {selectable(filters, frames.map((fr) => fr.filterId)).map((f) => (
                <option key={f.id} value={f.id}>
                  {optionLabel(f)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="frameSortBy">Sort by</label>
            <select id="frameSortBy" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
              <option value="type">Frame type</option>
              <option value="filter">Filter</option>
              <option value="newest">Newest first</option>
            </select>
          </div>
        </div>
      )}

      {frames.length > 0 && visibleFrames.length === 0 && (
        <div className="empty-state">No frames match this filter.</div>
      )}

      {visibleFrames.map((frame) => {
        const filterName = frameFilterName(frame, filters)
        return (
          <Link
            to={`/projects/${projectId}/sessions/${session.id}/frames/${frame.id}`}
            className="card-link"
            key={frame.id}
          >
            <div className="card">
              <div className="card-title-row">
                <h3>
                  {FRAME_TYPE_LABEL[frame.frameType]}
                  {filterName ? ` · ${filterName}` : ''}
                </h3>
                <StatusBadge
                  label={CAPTURE_STATUS_LABEL[frame.status]}
                  dot={CAPTURE_STATUS_DOT[frame.status]}
                />
              </div>
              <div className="muted">
                {frame.count} &times; {frame.exposureSeconds}s
                {frame.binning ? ` · Bin ${frame.binning}` : ''}
                {` · ${formatMinutes(totalExposureSeconds(frame) / 60)}`}
              </div>
            </div>
          </Link>
        )
      })}

      <Link
        to={`/projects/${projectId}/sessions/${session.id}/frames/new`}
        className="fab"
        aria-label="New frame batch"
      >
        +
      </Link>
    </div>
  )
}
