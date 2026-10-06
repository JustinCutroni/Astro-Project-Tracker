import { sortFilters } from '../lib/filters'
import type { CameraSnapshot, FilterSnapshot, MountSnapshot, TelescopeSnapshot } from '../types/models'

// Read-only equipment card for a session's recorded gear.
export function GearList({
  camera,
  telescope,
  mount,
  filters,
  retiredIds,
}: {
  camera?: CameraSnapshot
  telescope?: TelescopeSnapshot
  mount?: MountSnapshot
  filters?: FilterSnapshot[]
  retiredIds?: Set<string>
}) {
  if (!camera && !telescope && !mount && !filters?.length) return null
  const tag = (id: string) => (retiredIds?.has(id) ? ' (retired)' : '')

  return (
    <div className="card">
      {camera && (
        <div className="list-item">
          <span>Camera</span>
          <span className="muted">
            {camera.description}
            {tag(camera.id)}
            {camera.sensorWidthMm && camera.sensorHeightMm
              ? ` · ${camera.sensorWidthMm}×${camera.sensorHeightMm}mm`
              : ''}
            {camera.pixelSizeUm ? ` · ${camera.pixelSizeUm}µm pixels` : ''}
          </span>
        </div>
      )}
      {telescope && (
        <div className="list-item">
          <span>Telescope</span>
          <span className="muted">
            {telescope.description}
            {tag(telescope.id)}
            {telescope.focalLength ? ` · ${telescope.focalLength}` : ''}
          </span>
        </div>
      )}
      {mount && (
        <div className="list-item">
          <span>Mount</span>
          <span className="muted">
            {mount.description}
            {tag(mount.id)}
          </span>
        </div>
      )}
      {filters && filters.length > 0 && (
        <div className="list-item">
          <span>Filters</span>
          <span className="muted">
            {sortFilters(filters)
              .map((f) => `${f.description}${tag(f.id)}`)
              .join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}
