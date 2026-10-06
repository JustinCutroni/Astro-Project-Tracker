import type { CameraSnapshot, MountSnapshot, TelescopeSnapshot } from '../types/models'

// Read-only equipment card. Takes snapshot-shaped data, so it renders a
// session's recorded gear and a project's live gear identically.
export function GearList({
  camera,
  telescope,
  mount,
  retiredIds,
}: {
  camera?: CameraSnapshot
  telescope?: TelescopeSnapshot
  mount?: MountSnapshot
  retiredIds?: Set<string>
}) {
  if (!camera && !telescope && !mount) return null
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
    </div>
  )
}
