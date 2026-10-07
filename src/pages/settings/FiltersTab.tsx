import { useState } from 'react'
import { putDoc, useCollection } from '../../firebase/firestoreDb'
import { newId, nowIso } from '../../lib/ids'
import type { FilterDef } from '../../types/models'
import { useGearUsage } from '../../lib/gear'
import { CatalogList } from '../../components/settings/CatalogList'
import { FormActions } from '../../components/settings/FormActions'
import { numToField, sortedFilters } from '../../components/settings/helpers'

export function FiltersTab() {
  const filters = sortedFilters(useCollection<FilterDef>('filters'))
  const usage = useGearUsage()
  const [editing, setEditing] = useState<FilterDef | null>(null)
  const [description, setDescription] = useState('')
  const [position, setPosition] = useState('')

  function reset() {
    setEditing(null)
    setDescription('')
    setPosition('')
  }

  function startEdit(f: FilterDef) {
    setEditing(f)
    setDescription(f.description)
    setPosition(numToField(f.position))
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<FilterDef>('filters', {
      ...editing,
      id: editing?.id ?? newId(),
      description: description.trim(),
      position: position && Number(position) >= 1 ? Math.min(7, Math.floor(Number(position))) : undefined,
      dateAdded: editing?.dateAdded ?? nowIso(),
    })
    reset()
  }

  if (!filters) return null

  return (
    <div>
      <div className="settings-form">
        <form onSubmit={add} className="form-row form-row-end">
          <div className="form-field">
            <label>Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Ha"
            />
          </div>
          <div className="form-field field-narrow">
            <label>Position</label>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              type="number"
              min={1}
              max={7}
              step={1}
              placeholder="e.g. 1"
            />
          </div>
          <FormActions editing={!!editing} onCancel={reset} />
        </form>
      </div>
      <CatalogList
        name="filters"
        items={filters}
        usage={usage}
        emptyText="No filters added yet."
        onEdit={startEdit}
        renderItem={(f) => (
          <>
            {f.description} {f.position !== undefined && <span className="muted">(position {f.position})</span>}
          </>
        )}
      />
    </div>
  )
}
