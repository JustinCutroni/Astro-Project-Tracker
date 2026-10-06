import { optionLabel } from '../lib/gear'
import type { PositionInputs } from '../lib/filterPositions'
import type { FilterDef } from '../types/models'

// Per-session filter wheel slots. `filters` should already be limited to the
// ones worth listing; blank means "not in the wheel / not recorded".
export function FilterPositionFields({
  filters,
  value,
  onChange,
}: {
  filters: FilterDef[]
  value: PositionInputs
  onChange: (next: PositionInputs) => void
}) {
  if (filters.length === 0) return null
  return (
    <div className="form-field">
      <label>Filter wheel positions</label>
      <div className="form-row">
        {filters.map((f) => (
          <div className="form-field" style={{ flex: '0 0 6rem' }} key={f.id}>
            <label htmlFor={`pos-${f.id}`} className="muted" style={{ fontSize: '0.78rem' }}>
              {optionLabel(f)}
            </label>
            <input
              id={`pos-${f.id}`}
              type="number"
              min={1}
              step={1}
              value={value[f.id] ?? ''}
              onChange={(e) => onChange({ ...value, [f.id]: e.target.value })}
              placeholder="slot"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
