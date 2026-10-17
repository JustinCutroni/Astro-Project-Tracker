import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { bulkPut, putDoc, useCollection } from '../firebase/firestoreDb'
import { sortFilters } from '../lib/filters'
import { formatMinutes, today } from '../lib/format'
import { selectable, useGearCatalog } from '../lib/gear'
import { nowIso } from '../lib/ids'
import { useKnownLocations } from '../lib/locations'
import { MAX_NIGHTS, buildPlan, hoursPerNightFrom, nightDates, planNights, planNotes } from '../lib/planBuild'
import { matchFilter } from '../lib/planMatch'
import { PLAN_PROMPT, SKILL_PROMPT, parsePlan, type ProjectPlan } from '../lib/planParse'
import { splitTitle } from '../lib/planTitle'
import type { Frame, Project, Session } from '../types/models'

// Firestore allows 500 writes per batch.
const FRAME_BATCH_SIZE = 400

export function ImportProject() {
  const navigate = useNavigate()
  const catalog = useGearCatalog()
  const projects = useCollection<Project>('projects')
  const knownLocations = useKnownLocations()

  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [plan, setPlan] = useState<ProjectPlan>()
  // One catalog filter id per plan filter row; '' means skip that row.
  const [filterIds, setFilterIds] = useState<string[]>([])
  const [target, setTarget] = useState('')
  const [projectName, setProjectName] = useState('')
  const [hoursText, setHoursText] = useState('8')
  const [combineShort, setCombineShort] = useState(false)
  // Dates the user has entered, by night; nights beyond these get a default (see nightDates).
  const [dates, setDates] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  if (!catalog || !projects) return null

  // The nights follow from the filters chosen, the hours per night and the combine setting.
  const hoursPerNight = hoursPerNightFrom(hoursText)
  const nights = plan ? planNights(plan.filters, filterIds, hoursPerNight, combineShort) : []
  const tooManyNights = nights.length > MAX_NIGHTS
  const shownDates = tooManyNights ? [] : nightDates(dates, nights.length, today())
  const filterName = (id: string) => catalog.filters.find((f) => f.id === id)?.description ?? '?'
  const describeNight = (night: (typeof nights)[number]) => {
    const parts = night.shares.map((share) => {
      const row = plan!.filters[share.rowIndex]
      return `${filterName(filterIds[share.rowIndex])} ${share.subs} × ${row.exposureSeconds}s`
    })
    const minutes = night.shares.reduce((sum, share) => sum + (share.subs * plan!.filters[share.rowIndex].exposureSeconds) / 60, 0)
    return `${parts.join(' + ')} (${formatMinutes(minutes)})`
  }

  const copyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopyMessage('Copied.')
    } catch {
      setCopyMessage("Couldn't copy. Open the prompt below and copy it by hand.")
    }
  }

  const readPlan = () => {
    const result = parsePlan(text)
    if (!result.ok) {
      setError(result.error)
      setPlan(undefined)
      return
    }
    const split = splitTitle(result.plan.target)
    setError('')
    setPlan(result.plan)
    setTarget(split.target)
    setProjectName(split.projectName ?? '')
    setFilterIds(result.plan.filters.map((row) => matchFilter(row.filter, catalog.filters)?.id ?? ''))
    setDates([])
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || !plan) return
    setSaving(true)
    try {
      const built = buildPlan({ plan, target, projectName, filterIds, nights, dates: shownDates, location, catalog, now: nowIso() })
      await putDoc<Project>('projects', built.project)
      await bulkPut<Session>('sessions', built.sessions)
      for (let i = 0; i < built.frames.length; i += FRAME_BATCH_SIZE) {
        await bulkPut<Frame>('frames', built.frames.slice(i, i + FRAME_BATCH_SIZE))
      }
      navigate(`/projects/${built.project.id}`)
    } catch (err) {
      console.error('Import failed:', err)
      setError('Could not create the project. Please try again.')
      setSaving(false)
    }
  }

  const filterOptions = sortFilters(selectable(catalog.filters))
  const hasFilters = filterIds.some(Boolean)
  const canCreate = hasFilters && target.trim() !== '' && !tooManyNights
  const alreadyHasTarget = projects.some((p) => p.target.trim().toLowerCase() === target.trim().toLowerCase())

  return (
    <div>
      <Link to="/projects" className="back-link">
        &lsaquo; Projects
      </Link>
      <div className="page-header">
        <h2>Import plan</h2>
      </div>

      <div className="card">
        <h3>1. Ask your AI</h3>
        <p className="muted">
          Copy a prompt, give it to your AI along with an AstroBin link or a target, and paste its answer below.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button type="button" className="btn btn-sm" onClick={() => copyPrompt(SKILL_PROMPT)}>
            Copy astrobin-extractor command
          </button>
          <button type="button" className="btn btn-sm" onClick={() => copyPrompt(PLAN_PROMPT)}>
            Copy full prompt (any AI)
          </button>
        </div>
        {copyMessage && <p className="muted">{copyMessage}</p>}
        <details style={{ marginTop: '0.75rem' }}>
          <summary>Show the full prompt</summary>
          <textarea readOnly rows={14} value={PLAN_PROMPT} aria-label="AI prompt" />
        </details>
      </div>

      <div className="form-field">
        <label htmlFor="plan-text">2. Paste the plan</label>
        <textarea
          id="plan-text"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste what your AI wrote"
        />
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={readPlan} disabled={!text.trim()}>
          Read plan
        </button>
      </div>
      {error && (
        <p role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {plan && (
        <form onSubmit={create}>
          <div className="card">
            <h3>3. Check the plan</h3>
            <pre className="muted" style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
              {`${plan.goalHours ? `Goal ${plan.goalHours}h\n` : ''}${planNotes(plan)}`}
            </pre>
          </div>

          <div className="form-field">
            <label htmlFor="plan-target">Target *</label>
            <input
              id="plan-target"
              value={target}
              maxLength={100}
              onChange={(e) => setTarget(e.target.value)}
              required
            />
            {alreadyHasTarget && target.trim() && (
              <div className="muted">You already have a project for this target. Importing creates a separate one.</div>
            )}
          </div>
          <div className="form-field">
            <label htmlFor="plan-project-name">Project name</label>
            <input
              id="plan-project-name"
              value={projectName}
              maxLength={150}
              placeholder="Defaults to the target"
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          <h3>Filters</h3>
          {plan.filters.map((row, i) => (
            <div className="form-field" key={i}>
              <label htmlFor={`plan-filter-${i}`}>
                {row.filter} · {row.subs} × {row.exposureSeconds}s
              </label>
              <select id={`plan-filter-${i}`} value={filterIds[i]} onChange={(e) => setFilterIds(filterIds.map((id, row) => (row === i ? e.target.value : id)))}>
                <option value="">Skip this filter</option>
                {filterOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.description}
                  </option>
                ))}
              </select>
              {!filterIds[i] && <div className="muted">No match in your filters. Pick one, or skip it.</div>}
            </div>
          ))}

          <h3>Nights</h3>
          <p className="muted">
            Each night is one filter. A filter with more hours than fit in a night is spread over several nights, its
            subs split evenly. Each night becomes a planned session with its Light, Flat and Flat-Dark batches.
          </p>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="plan-hours">Hours per night</label>
              <input
                id="plan-hours"
                type="number"
                min={1}
                max={24}
                step={0.5}
                value={hoursText}
                onChange={(e) => setHoursText(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="plan-location">Location</label>
              <input
                id="plan-location"
                list="known-locations"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <datalist id="known-locations">
                {knownLocations.map((loc) => (
                  <option value={loc} key={loc} />
                ))}
              </datalist>
            </div>
          </div>
          <label className="list-item" style={{ cursor: 'pointer' }}>
            <span>Let short filters share a night</span>
            <input type="checkbox" checked={combineShort} onChange={(e) => setCombineShort(e.target.checked)} />
          </label>

          {tooManyNights ? (
            <p role="alert" style={{ color: 'var(--danger)' }}>
              That makes {nights.length} nights, and the most is {MAX_NIGHTS}. Raise the hours per night.
            </p>
          ) : (
            nights.map((night, index) => (
              <div className="form-field" key={index}>
                <label htmlFor={`plan-date-${index}`}>
                  Night {index + 1} · {describeNight(night)}
                </label>
                <input
                  id={`plan-date-${index}`}
                  type="date"
                  value={shownDates[index]}
                  onChange={(e) => setDates(shownDates.map((d, i) => (i === index ? e.target.value : d)))}
                  required
                />
              </div>
            ))
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-block" disabled={saving || !canCreate}>
              {saving ? 'Creating…' : 'Create project'}
            </button>
          </div>
          {!hasFilters && <p className="muted">Pick at least one filter to create the project.</p>}
          {hasFilters && !canCreate && <p className="muted">The project needs a target.</p>}
        </form>
      )}
    </div>
  )
}
