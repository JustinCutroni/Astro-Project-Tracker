import { IconClose, IconEdit } from '../icons'

// Locations are plain free-text suggestions, so they keep the simple
// edit/remove pair.
export function RowButtons({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  return (
    <span className="row-actions">
      <button className="icon-btn" onClick={onEdit} aria-label="Edit">
        <IconEdit />
      </button>
      <button className="icon-btn" onClick={onRemove} aria-label="Remove">
        <IconClose />
      </button>
    </span>
  )
}
