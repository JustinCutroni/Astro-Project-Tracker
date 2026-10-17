import { sortFilters } from '../lib/filters'
import {
  effectiveReplacements,
  optionLabel,
  removedFiltersInUse,
  selectable,
  type GearCatalog,
  type GearIds,
} from '../lib/gear'

// Camera / telescope / mount pickers and the filter set for a session. Retired
// gear is hidden unless the session already uses it (so editing an old session
// keeps its gear).
//
// While a session is planned, its filters can change even though batches
// already use them. `originalFilterIds` and `usedFilterIds` (the filters those
// batches use) let this show where batches on a dropped filter will move to;
// the chosen overrides live in the parent so it can apply them on save.
export function GearFields({
  catalog,
  ids,
  onChange,
  filtersLocked = false,
  originalFilterIds = [],
  usedFilterIds = [],
  replacementOverrides = {},
  onReplacementOverridesChange,
}: {
  catalog: GearCatalog
  ids: GearIds
  onChange: (ids: GearIds) => void
  filtersLocked?: boolean
  originalFilterIds?: string[]
  usedFilterIds?: (string | undefined)[]
  replacementOverrides?: Record<string, string>
  onReplacementOverridesChange?: (overrides: Record<string, string>) => void
}) {
  const cameras = selectable(catalog.cameras, [ids.cameraId])
  const telescopes = selectable(catalog.telescopes, [ids.telescopeId])
  const mounts = selectable(catalog.mounts, [ids.mountId])
  const filters = sortFilters(selectable(catalog.filters, ids.filterIds))
  const filterName = (id: string) => catalog.filters.find((f) => f.id === id)?.description ?? 'Unknown filter'

  const removed = removedFiltersInUse(originalFilterIds, ids.filterIds, usedFilterIds)
  const replacements = effectiveReplacements(originalFilterIds, ids.filterIds, usedFilterIds, replacementOverrides)

  function toggleFilter(id: string) {
    onChange({
      ...ids,
      filterIds: ids.filterIds.includes(id) ? ids.filterIds.filter((f) => f !== id) : [...ids.filterIds, id],
    })
  }

  return (
    <>
      <div className="form-row">
        <div className="form-field">
          <label htmlFor="session-camera">Camera</label>
          <select
            id="session-camera"
            value={ids.cameraId}
            onChange={(e) => onChange({ ...ids, cameraId: e.target.value })}
          >
            <option value="">Not set</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {optionLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="session-telescope">Telescope</label>
          <select
            id="session-telescope"
            value={ids.telescopeId}
            onChange={(e) => onChange({ ...ids, telescopeId: e.target.value })}
          >
            <option value="">Not set</option>
            {telescopes.map((t) => (
              <option key={t.id} value={t.id}>
                {optionLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="session-mount">Mount</label>
          <select
            id="session-mount"
            value={ids.mountId}
            onChange={(e) => onChange({ ...ids, mountId: e.target.value })}
          >
            <option value="">Not set</option>
            {mounts.map((m) => (
              <option key={m.id} value={m.id}>
                {optionLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filters.length > 0 && (
        <div className="form-field">
          <label>Filters</label>
          {filtersLocked ? (
            <div className="muted">
              {filters
                .filter((f) => ids.filterIds.includes(f.id))
                .map((f) => optionLabel(f))
                .join(', ') || 'None'}
              {' · '}
              Locked once a session has been captured. Set it back to Planning to change them.
            </div>
          ) : (
            <details className="multi-select">
              <summary>
                {ids.filterIds.length === 0
                  ? 'None selected'
                  : filters
                      .filter((f) => ids.filterIds.includes(f.id))
                      .map((f) => f.description)
                      .join(', ')}
              </summary>
              <div className="multi-select-menu">
                {filters.map((f) => (
                  <label key={f.id} className="list-item" style={{ cursor: 'pointer' }}>
                    <span>{optionLabel(f)}</span>
                    <input
                      type="checkbox"
                      checked={ids.filterIds.includes(f.id)}
                      onChange={() => toggleFilter(f.id)}
                    />
                  </label>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {!filtersLocked && removed.length > 0 && (
        <div className="card">
          <h3>Frame batches on removed filters</h3>
          {removed.map((id) => (
            <div className="form-field" key={id}>
              <label htmlFor={`replace-${id}`}>Move {filterName(id)} batches to</label>
              <select
                id={`replace-${id}`}
                value={replacements[id] ?? ''}
                onChange={(e) =>
                  onReplacementOverridesChange?.({ ...replacementOverrides, [id]: e.target.value })
                }
              >
                <option value="">No filter</option>
                {filters
                  .filter((f) => ids.filterIds.includes(f.id))
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.description}
                    </option>
                  ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
