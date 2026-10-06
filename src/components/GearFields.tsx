import { optionLabel, selectable, type GearCatalog, type GearIds } from '../lib/gear'

// Camera / telescope / mount pickers for a session. Retired gear is hidden
// unless the session already uses it (so editing an old session keeps its gear).
export function GearFields({
  catalog,
  ids,
  onChange,
}: {
  catalog: GearCatalog
  ids: GearIds
  onChange: (ids: GearIds) => void
}) {
  const cameras = selectable(catalog.cameras, [ids.cameraId])
  const telescopes = selectable(catalog.telescopes, [ids.telescopeId])
  const mounts = selectable(catalog.mounts, [ids.mountId])

  return (
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
  )
}
