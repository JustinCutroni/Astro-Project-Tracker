import { STATUS_LABEL } from '../lib/status'
import { STATUSES, type Status } from '../types/models'

// Overall progress through the pipeline: a bar for the percentage, and the
// stage names beneath it with the current one picked out.
export function PipelineProgress({ percent, status }: { percent: number; status: Status }) {
  const current = STATUSES.indexOf(status)
  return (
    <div
      role="progressbar"
      aria-label="Project progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%, ${STATUS_LABEL[status]}`}
    >
      <div className="progress-track pipeline-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="pipeline-stages">
        {STATUSES.map((s, i) => (
          <span key={s} className={i === current ? 'current' : i < current ? 'done' : undefined}>
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  )
}
