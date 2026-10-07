import { useState } from 'react'
import { putDoc, useCollection } from '../../firebase/firestoreDb'
import { newId, nowIso } from '../../lib/ids'
import { findCameraSpec, searchCameraCatalog, type CameraSpec } from '../../data/cameraCatalog'
import type { Camera } from '../../types/models'
import { useGearUsage } from '../../lib/gear'
import { CatalogList } from '../../components/settings/CatalogList'
import { FormActions } from '../../components/settings/FormActions'
import { Suggestions } from '../../components/settings/Suggestions'
import { byDescription, fieldToNum, numToField } from '../../components/settings/helpers'

// The camera form holds every field as a string; these convert to and from
// the stored Camera.
interface CameraForm {
  description: string
  cameraType: string
  sensorWidthMm: string
  sensorHeightMm: string
  pixelSizeUm: string
  resolutionWidthPx: string
  resolutionHeightPx: string
  defaultGain: string
}

const EMPTY_FORM: CameraForm = {
  description: '',
  cameraType: '',
  sensorWidthMm: '',
  sensorHeightMm: '',
  pixelSizeUm: '',
  resolutionWidthPx: '',
  resolutionHeightPx: '',
  defaultGain: '',
}

// The spec fields that auto-fill from the catalog (everything but the name and type).
const SPEC_BLANKS = {
  sensorWidthMm: '',
  sensorHeightMm: '',
  pixelSizeUm: '',
  resolutionWidthPx: '',
  resolutionHeightPx: '',
  defaultGain: '',
}

function cameraToForm(c: Camera): CameraForm {
  return {
    description: c.description,
    cameraType: c.cameraType ?? '',
    sensorWidthMm: numToField(c.sensorWidthMm),
    sensorHeightMm: numToField(c.sensorHeightMm),
    pixelSizeUm: numToField(c.pixelSizeUm),
    resolutionWidthPx: numToField(c.resolutionWidthPx),
    resolutionHeightPx: numToField(c.resolutionHeightPx),
    defaultGain: numToField(c.defaultGain),
  }
}

function specToForm(spec: CameraSpec): CameraForm {
  return {
    description: spec.model,
    cameraType: spec.sensorType,
    sensorWidthMm: String(spec.sensorWidthMm),
    sensorHeightMm: String(spec.sensorHeightMm),
    pixelSizeUm: String(spec.pixelSizeUm),
    resolutionWidthPx: String(spec.resolutionWidthPx),
    resolutionHeightPx: String(spec.resolutionHeightPx),
    defaultGain: numToField(spec.defaultGain),
  }
}

function formToCamera(f: CameraForm): Partial<Camera> {
  return {
    description: f.description.trim(),
    cameraType: f.cameraType.trim() || undefined,
    sensorWidthMm: fieldToNum(f.sensorWidthMm),
    sensorHeightMm: fieldToNum(f.sensorHeightMm),
    pixelSizeUm: fieldToNum(f.pixelSizeUm),
    resolutionWidthPx: fieldToNum(f.resolutionWidthPx),
    resolutionHeightPx: fieldToNum(f.resolutionHeightPx),
    defaultGain: fieldToNum(f.defaultGain),
  }
}

export function CamerasTab() {
  const cameras = byDescription(useCollection<Camera>('cameras'))
  const usage = useGearUsage()
  const [editing, setEditing] = useState<Camera | null>(null)
  const [form, setForm] = useState<CameraForm>(EMPTY_FORM)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestions = showSuggestions ? searchCameraCatalog(form.description) : []

  function setField(patch: Partial<CameraForm>) {
    setForm((f) => ({ ...f, ...patch }))
  }

  function applySpec(spec: CameraSpec) {
    setForm(specToForm(spec))
    setShowSuggestions(false)
  }

  function handleDescriptionBlur() {
    setTimeout(() => setShowSuggestions(false), 150)
    // If specs are still blank, see if the typed name matches a known model.
    if (!form.sensorWidthMm) {
      const spec = findCameraSpec(form.description)
      if (spec) applySpec(spec)
    }
  }

  function reset() {
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  function startEdit(c: Camera) {
    setEditing(c)
    setForm(cameraToForm(c))
    setShowSuggestions(false)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) return
    await putDoc<Camera>('cameras', {
      ...editing,
      id: editing?.id ?? newId(),
      ...formToCamera(form),
      description: form.description.trim(),
      dateAdded: editing?.dateAdded ?? nowIso(),
    })
    reset()
  }

  if (!cameras) return null

  return (
    <div>
      <div className="settings-form">
        <form onSubmit={add}>
          <div className="form-row">
            <div className="form-field autocomplete-wrap">
              <label>Description</label>
              <input
                value={form.description}
                onChange={(e) =>
                  setField(
                    editing
                      ? { description: e.target.value }
                      : { description: e.target.value, ...SPEC_BLANKS },
                  )
                }
                onFocus={() => setShowSuggestions(true)}
                onBlur={handleDescriptionBlur}
                autoComplete="off"
                placeholder="e.g. ZWO ASI2600MM Pro"
              />
              <Suggestions
                items={suggestions.map((s) => s.model)}
                onPick={(i) => applySpec(suggestions[i])}
              />
            </div>
            <div className="form-field field-narrow">
              <label>Type</label>
              <input
                value={form.cameraType}
                onChange={(e) => setField({ cameraType: e.target.value })}
                placeholder="e.g. Mono"
              />
            </div>
            <div className="form-field field-narrow">
              <label>Default gain</label>
              <input
                value={form.defaultGain}
                onChange={(e) => setField({ defaultGain: e.target.value })}
                type="number"
                placeholder="e.g. 100"
              />
            </div>
          </div>

          {(form.sensorWidthMm || form.sensorHeightMm || form.pixelSizeUm) && (
            <div className="form-row">
              <div className="form-field">
                <label>Sensor (mm)</label>
                <div className="form-row form-row-tight">
                  <input
                    value={form.sensorWidthMm}
                    onChange={(e) => setField({ sensorWidthMm: e.target.value })}
                    placeholder="width"
                    type="number"
                    step="0.1"
                  />
                  <input
                    value={form.sensorHeightMm}
                    onChange={(e) => setField({ sensorHeightMm: e.target.value })}
                    placeholder="height"
                    type="number"
                    step="0.1"
                  />
                </div>
              </div>
              <div className="form-field field-pixel">
                <label>Pixel ({'µ'}m)</label>
                <input
                  value={form.pixelSizeUm}
                  onChange={(e) => setField({ pixelSizeUm: e.target.value })}
                  type="number"
                  step="0.01"
                />
              </div>
              <div className="form-field">
                <label>Resolution (px)</label>
                <div className="form-row form-row-tight">
                  <input
                    value={form.resolutionWidthPx}
                    onChange={(e) => setField({ resolutionWidthPx: e.target.value })}
                    placeholder="width"
                    type="number"
                  />
                  <input
                    value={form.resolutionHeightPx}
                    onChange={(e) => setField({ resolutionHeightPx: e.target.value })}
                    placeholder="height"
                    type="number"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="form-buttons">
            <FormActions editing={!!editing} onCancel={reset} />
          </div>
        </form>
      </div>
      <CatalogList
        name="cameras"
        items={cameras}
        usage={usage}
        emptyText="No cameras added yet."
        onEdit={startEdit}
        renderItem={(c) => (
          <>
            {c.description} {c.cameraType && <span className="muted">({c.cameraType})</span>}
            {(c.sensorWidthMm || c.defaultGain !== undefined) && (
              <div className="muted spec-summary">
                {c.sensorWidthMm && c.pixelSizeUm && (
                  <>
                    {c.sensorWidthMm} &times; {c.sensorHeightMm}mm &middot; {c.pixelSizeUm}
                    {'µ'}m pixels
                    {c.resolutionWidthPx && ` · ${c.resolutionWidthPx}×${c.resolutionHeightPx}`}
                  </>
                )}
                {c.defaultGain !== undefined && ` · Default gain ${c.defaultGain}`}
              </div>
            )}
          </>
        )}
      />
    </div>
  )
}
