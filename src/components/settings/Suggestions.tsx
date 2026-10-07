export function Suggestions({ items, onPick }: { items: string[]; onPick: (i: number) => void }) {
  if (items.length === 0) return null
  return (
    <ul className="suggestion-list">
      {items.map((label, i) => (
        <li key={label}>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); onPick(i) }}>
            {label}
          </button>
        </li>
      ))}
    </ul>
  )
}
