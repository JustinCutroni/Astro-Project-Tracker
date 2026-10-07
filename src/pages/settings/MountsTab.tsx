import { useState } from 'react'
import { putDoc, useCollection } from '../../firebase/firestoreDb'
import { newId, nowIso } from '../../lib/ids'
import { searchMountCatalog } from '../../data/mountCatalog'
import type { Mount } from '../../types/models'
import { useGearUsage } from '../../lib/gear'
import { CatalogList } from '../../components/settings/CatalogList'
import { FormActions } from '../../components/settings/FormActions'
import { Suggestions } from '../../components/settings/Suggestions'
import { byDescription } from '../../components/settings/helpers'

export function MountsTab() {
  const mounts = byDescription(useCollection<Mount>('mounts'))
  const usage = useGearUsage()
  const [editing, setEditing] = useState<Mount | null>(null)
  const [description, setDescription] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestions = showSuggestions ? searchMountCatalog(description) : []

  function reset() {
    setEditing(null)
    setDescription('')
  }

  function startEdit(m: Mount) {
    setEditing(m)
    setDescription(m.description)
    setShowSuggestions(false)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    await putDoc<Mount>('mounts', {
      ...editing,
      id: editing?.id ?? newId(),
      description: description.trim(),
      dateAdded: editing?.dateAdded ?? nowIso(),
    })
    reset()
  }

  if (!mounts) return null

  return (
    <div>
      <div className="settings-form">
        <form onSubmit={add} className="form-row form-row-end">
          <div className="form-field autocomplete-wrap">
            <label>Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              autoComplete="off"
              placeholder="e.g. EQ6-R Pro"
            />
            <Suggestions
              items={suggestions}
              onPick={(i) => {
                setDescription(suggestions[i])
                setShowSuggestions(false)
              }}
            />
          </div>
          <FormActions editing={!!editing} onCancel={reset} />
        </form>
      </div>
      <CatalogList
        name="mounts"
        items={mounts}
        usage={usage}
        emptyText="No mounts added yet."
        onEdit={startEdit}
        renderItem={(m) => m.description}
      />
    </div>
  )
}
