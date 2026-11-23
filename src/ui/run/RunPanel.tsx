import type { RunStatus } from '../../state/runController'
import './RunPanel.css'

export type { RunStatus }

interface Props {
  status: RunStatus
  daysDone: number
  totalDays: number
  message?: string
  onRun: () => void
  onCancel: () => void
}

export default function RunPanel({
  status,
  daysDone,
  totalDays,
  message,
  onRun,
  onCancel,
}: Props) {
  const running = status === 'running'

  return (
    <section className="run" aria-label="Run">
      <div className="run-buttons">
        <button className="run-button" type="button" disabled={running} onClick={onRun}>
          Run
        </button>
        <button className="cancel-button" type="button" disabled={!running} onClick={onCancel}>
          Cancel
        </button>
      </div>

      {running && (
        <div className="run-progress">
          <progress value={daysDone} max={totalDays > 0 ? totalDays : 1} />
          <span>{`Day ${daysDone} of ${totalDays}`}</span>
        </div>
      )}

      {status === 'done' && <p className="run-note">Run finished.</p>}
      {status === 'cancelled' && <p className="run-note">Run cancelled.</p>}
      {status === 'error' && <p className="run-note">{`Run failed: ${message ?? 'unknown error'}`}</p>}
    </section>
  )
}