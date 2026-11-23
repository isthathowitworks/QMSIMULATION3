import type { RunPhase, RunStatus } from '../../state/runController'
import './RunPanel.css'

export type { RunStatus }

interface Props {
  status: RunStatus
  phase?: RunPhase | null // which of the two runs is going while status is running
  daysDone: number
  totalDays: number
  message?: string
  onRun: () => void
  onCancel: () => void
}

const PHASE_TEXT: Record<RunPhase, string> = {
  baseline: 'Running the do-nothing baseline (no cleaning, no fogging)',
  policy: 'Running your policy',
}

export default function RunPanel({
  status,
  phase,
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

      {running && phase && <p className="run-note">{PHASE_TEXT[phase]}</p>}

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