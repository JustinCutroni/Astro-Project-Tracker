import { useState } from 'react'
import { putDoc, useCollection } from '../../firebase/firestoreDb'
import { newId, nowIso } from '../../lib/ids'
import { findTelescopeSpec, searchTelescopeCatalog, type TelescopeSpec } from '../../data/telescopeCatalog'
import type { Telescope } from '../../types/models'
import { useGearUsage } from '../../lib/gear'
import { CatalogList } from '../../components/settings/CatalogList'
import { FormActions } from '../../components/settings/FormActions'
import { Suggestions } from '../../components/settings/Suggestions'
import { byDescription } from '../../components/settings/helpers'

export function TelescopesTab() {
  const telescopes = byDescription(useCollection<Telescope>('telescopes'))
  const usage = useGearUsage()
  const [editing, setEditing] = useState<Telescope | null>(null)
  const [description, setDescription] = useState('')
  const [focalLength, setFocalLength] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestions = showSuggestions ? searchTelescopeCatalog(description) : []

  function applySpec(spec: TelescopeSpec) {
    setDescription(spec.model)
    setFocalLength(String(spec.focalLengthMm))
    setShowSuggestions(false)
  }

  function handleBlur() {
    setTimeout(() => setShowSuggestions(false), 150)
    if (!focalLength) {
      const spec = findTelescopeSpec(description)
      if (spec) applySpec(spec)
    }
  }

  function reset() {
    setEditing(null)
    setDescription('')
    setFocalLength('')
  }

  function startEdit(t: Telescope) {
    setEditing(t)
    setDescription(t.description)
    setFocalLength(t.focalLength ?? '')
    setShowSuggestions(false)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<Telescope>('telescopes', {
      ...editing,
      id: editing?.id ?? newId(),
      description: description.trim(),
      focalLength: focalLength.trim() || undefined,
      dateAdded: editing?.dateAdded ?? nowIso(),
    })
    reset()
  }

  if (!telescopes) return null

  return (
    <div>
      <div className="settings-form">
        <form onSubmit={add} className="form-row form-row-end">
          <div className="form-field autocomplete-wrap">
            <label>Description</label>
            <input
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                if (!editing) setFocalLength('')
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={handleBlur}
              autoComplete="off"
              placeholder="e.g. 8in RC Telescope"
            />
            <Suggestions
              items={suggestions.map((s) => `${s.model} (${s.focalLengthMm}mm)`)}
              onPick={(i) => applySpec(suggestions[i])}
            />
          </div>
          <div className="form-field field-narrow">
            <label>Focal length</label>
            <input
              value={focalLength}
              onChange={(e) => setFocalLength(e.target.value)}
              placeholder="1600"
            />
          </div>
          <FormActions editing={!!editing} onCancel={reset} />
        </form>
      </div>
      <CatalogList
        name="telescopes"
        items={telescopes}
        usage={usage}
        emptyText="No telescopes added yet."
        onEdit={startEdit}
        renderItem={(t) => (
          <>
            {t.description} {t.focalLength && <span className="muted">({t.focalLength}mm)</span>}
          </>
        )}
      />
    </div>
  )
}
