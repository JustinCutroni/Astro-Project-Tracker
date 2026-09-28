import type { ProjectStatus } from '../types/models'
import { STATUS_DOT, STATUS_LABEL } from '../lib/status'

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className="badge"
      style={{ '--dot': STATUS_DOT[status] } as React.CSSProperties}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
