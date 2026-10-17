import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { bulkPut, putDoc, useCollection } from '../firebase/firestoreDb'
import { GearFields } from '../components/GearFields'
import { sortFilters } from '../lib/filters'
import { today } from '../lib/format'
import { selectable, useGearCatalog, type GearIds } from '../lib/gear'
import { nowIso } from '../lib/ids'
import { useKnownLocations } from '../lib/locations'
import { buildPlan, clampNights, nightDates, planNotes } from '../lib/planBuild'
import { matchFilter, matchGear } from '../lib/planMatch'
import { PLAN_PROMPT, parsePlan, type ProjectPlan } from '../lib/planParse'
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
  const [gearIds, setGearIds] = useState<GearIds>({ cameraId: '', telescopeId: '', mountId: '', filterIds: [] })
  const [dates, setDates] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  if (!catalog || !projects) return null

  const includedSubs = (rows: ProjectPlan['filters'], ids: string[]) =>
    rows.filter((_, i) => ids[i]).map((row) => row.subs)

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(PLAN_PROMPT)
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
    const { equipment, filters } = result.plan
    setError('')
    setPlan(result.plan)
    setFilterIds(filters.map((row) => matchFilter(row.filter, catalog.filters)?.id ?? ''))
    setGearIds({
      cameraId: matchGear(equipment.camera ?? '', catalog.cameras)?.id ?? '',
      telescopeId: matchGear(equipment.telescope ?? '', catalog.telescopes)?.id ?? '',
      mountId: matchGear(equipment.mount ?? '', catalog.mounts)?.id ?? '',
      filterIds: [],
    })
    setDates(nightDates([], 1, today()))
  }

  const chooseFilter = (row: number, filterId: string) => {
    if (!plan) return
    const next = filterIds.map((id, i) => (i === row ? filterId : id))
    setFilterIds(next)
    // Skipping the biggest filter can lower how many nights make sense.
    setDates(nightDates(dates, clampNights(dates.length, includedSubs(plan.filters, next)), today()))
  }

  const chooseNights = (requested: number) => {
    if (!plan) return
    setDates(nightDates(dates, clampNights(requested, includedSubs(plan.filters, filterIds)), today()))
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || !plan) return
    setSaving(true)
    try {
      const built = buildPlan({ plan, filterIds, dates, location, gear: gearIds, catalog, now: nowIso() })
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
  const hasFilters = plan ? includedSubs(plan.filters, filterIds).length > 0 : false
  const alreadyHasTarget =
    plan && projects.some((p) => p.target.trim().toLowerCase() === plan.target.toLowerCase())
  const named = plan ? [plan.equipment.camera, plan.equipment.telescope, plan.equipment.mount].filter(Boolean) : []

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
          Tell your AI the target (or an AstroBin image) and give it this prompt. It will answer with a plan to
          paste below.
        </p>
        <button type="button" className="btn btn-sm" onClick={copyPrompt}>
          Copy AI prompt
        </button>
        {copyMessage && <span className="muted"> {copyMessage}</span>}
        <details style={{ marginTop: '0.75rem' }}>
          <summary>Show the prompt</summary>
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
              {`${plan.target}${plan.goalHours ? ` · goal ${plan.goalHours}h` : ''}\n${planNotes(plan)}`}
            </pre>
            {alreadyHasTarget && (
              <p className="muted">You already have a project for this target. Importing creates a separate one.</p>
            )}
          </div>

          <h3>Filters</h3>
          {plan.filters.map((row, i) => (
            <div className="form-field" key={i}>
              <label htmlFor={`plan-filter-${i}`}>
                {row.filter} · {row.subs} × {row.exposureSeconds}s
              </label>
              <select id={`plan-filter-${i}`} value={filterIds[i]} onChange={(e) => chooseFilter(i, e.target.value)}>
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

          <h3>Equipment</h3>
          <GearFields catalog={catalog} ids={gearIds} onChange={setGearIds} hideFilters />
          {named.length > 0 && <p className="muted">The plan named: {named.join(' · ')}</p>}

          <h3>Nights</h3>
          <p className="muted">
            Subs are split evenly across the nights. Each night becomes a planned session with its Light, Flat and
            Flat-Dark batches.
          </p>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="plan-nights">Number of nights</label>
              <input
                id="plan-nights"
                type="number"
                min={1}
                value={dates.length}
                onChange={(e) => chooseNights(Number(e.target.value))}
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
          {dates.map((date, night) => (
            <div className="form-field" key={night}>
              <label htmlFor={`plan-date-${night}`}>Night {night + 1}</label>
              <input
                id={`plan-date-${night}`}
                type="date"
                value={date}
                onChange={(e) => setDates(dates.map((d, i) => (i === night ? e.target.value : d)))}
                required
              />
            </div>
          ))}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-block" disabled={saving || !hasFilters}>
              {saving ? 'Creating…' : 'Create project'}
            </button>
          </div>
          {!hasFilters && <p className="muted">Pick at least one filter to create the project.</p>}
        </form>
      )}
    </div>
  )
}
