import { useState } from 'react'
import { putDoc, removeDoc, useCollection } from '../../firebase/firestoreDb'
import { newId, nowIso } from '../../lib/ids'
import type { Location } from '../../types/models'
import { FormActions } from '../../components/settings/FormActions'
import { RowButtons } from '../../components/settings/RowButtons'
import { byDescription } from '../../components/settings/helpers'

export function LocationsTab() {
  const locations = byDescription(useCollection<Location>('locations'))
  const [editing, setEditing] = useState<Location | null>(null)
  const [description, setDescription] = useState('')

  function reset() {
    setEditing(null)
    setDescription('')
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<Location>('locations', {
      ...editing,
      id: editing?.id ?? newId(),
      description: description.trim(),
      dateAdded: editing?.dateAdded ?? nowIso(),
    })
    reset()
  }

  if (!locations) return null

  return (
    <div>
      <div className="settings-form">
        <form onSubmit={add} className="form-row form-row-end">
          <div className="form-field">
            <label>Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Remote Observatory - Utah"
            />
          </div>
          <FormActions editing={!!editing} onCancel={reset} />
        </form>
      </div>
      <div className="card">
        {locations.length === 0 && <div className="muted">No locations added yet.</div>}
        {locations.map((l) => (
          <div className="list-item" key={l.id}>
            <span>{l.description}</span>
            <RowButtons
              onEdit={() => {
                setEditing(l)
                setDescription(l.description)
              }}
              onRemove={() => removeDoc('locations', l.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
