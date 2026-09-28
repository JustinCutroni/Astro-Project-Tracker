export function StatusBadge({ label, dot }: { label: string; dot: string }) {
  return (
    <span className="badge" style={{ '--dot': dot } as React.CSSProperties}>
      {label}
    </span>
  )
}
