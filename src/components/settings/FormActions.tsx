// Shared by every tab: the add form doubles as the edit form. Clicking the
// pencil loads an item into the form; saving overwrites it in place.
export function FormActions({ editing, onCancel }: { editing: boolean; onCancel: () => void }) {
  return (
    <>
      <button type="submit" className="btn btn-primary">
        {editing ? 'Save' : 'Add'}
      </button>
      {editing && (
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      )}
    </>
  )
}
