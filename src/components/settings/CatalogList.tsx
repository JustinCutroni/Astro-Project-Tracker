import { useState } from 'react'
import { removeDoc, type CollectionName } from '../../firebase/firestoreDb'
import { formatDate } from '../../lib/format'
import type { Retirable } from '../../types/models'
import { IconArchive, IconClose, IconEdit, IconRestore } from '../icons'
import { setRetired } from './helpers'

// The list card shared by the gear tabs (cameras, telescopes, mounts,
// filters). Gear that anything refers to can only be retired - hidden from
// pickers but kept so history still resolves - and is deletable only while
// nothing uses it. Retired gear is tucked behind a toggle and can be restored.
export function CatalogList<T extends Retirable>({
  name,
  items,
  usage,
  emptyText,
  renderItem,
  onEdit,
}: {
  name: CollectionName
  items: T[]
  usage: Map<string, number> | undefined
  emptyText: string
  renderItem: (item: T) => React.ReactNode
  onEdit: (item: T) => void
}) {
  const [showRetired, setShowRetired] = useState(false)
  const active = items.filter((i) => !i.retiredAt)
  const retired = items.filter((i) => i.retiredAt)
  const visible = showRetired ? [...active, ...retired] : active

  return (
    <div className="card">
      {items.length === 0 && <div className="muted">{emptyText}</div>}
      {items.length > 0 && visible.length === 0 && (
        <div className="muted">Everything here is retired.</div>
      )}
      {visible.map((item) => {
        const isRetired = Boolean(item.retiredAt)
        // Unknown usage (still loading) is treated as "in use" - never offer a
        // delete we can't yet vouch for.
        const canDelete = usage !== undefined && !usage.get(item.id)
        return (
          <div className={isRetired ? 'list-item list-item-retired' : 'list-item'} key={item.id}>
            <span>
              {renderItem(item)}
              {isRetired && <span className="muted"> · retired {formatDate(item.retiredAt!)}</span>}
            </span>
            <span className="row-actions">
              <button className="icon-btn" onClick={() => onEdit(item)} aria-label="Edit">
                <IconEdit />
              </button>
              <button
                className="icon-btn"
                onClick={() => setRetired(name, item, !isRetired)}
                aria-label={isRetired ? 'Restore' : 'Retire'}
                title={
                  isRetired
                    ? 'Restore - offer it in pickers again'
                    : 'Retire - hide it from pickers but keep it in your history'
                }
              >
                {isRetired ? <IconRestore /> : <IconArchive />}
              </button>
              {canDelete && (
                <button
                  className="icon-btn"
                  onClick={() => removeDoc(name, item.id)}
                  aria-label="Delete"
                  title="Delete - nothing uses this"
                >
                  <IconClose />
                </button>
              )}
            </span>
          </div>
        )
      })}
      {retired.length > 0 && (
        <div className="list-item">
          <button type="button" className="btn btn-sm" onClick={() => setShowRetired((v) => !v)}>
            {showRetired ? 'Hide' : 'Show'} retired ({retired.length})
          </button>
        </div>
      )}
      {items.length > 0 && (
        <div className="muted catalog-hint">
          Retire gear you no longer use or have sold. Anything used in a session or frame
          can only be retired, so your history stays intact.
        </div>
      )}
    </div>
  )
}
