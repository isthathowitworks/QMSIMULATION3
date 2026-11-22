import type { PolicyControls } from '../../state/policyControls'
import {
  CLEANING_PRESETS,
  MAX_RUNS,
  applyPreset,
  clampControls,
  matchingPreset,
} from '../../state/policyControls'
import './ControlPanel.css'

interface Props {
  controls: PolicyControls
  onChange: (next: PolicyControls) => void
}

function intervalLabel(days: number): string {
  if (days <= 0) return 'No cleaning'
  if (days === 1) return 'Every day'
  return `Every ${days} days`
}

export default function ControlPanel({ controls, onChange }: Props) {
  const set = (change: Partial<PolicyControls>) =>
    onChange(clampControls({ ...controls, ...change }))
  const active = matchingPreset(controls)
  const percent = Math.round(controls.compliance * 100)

  return (
    <section className="controls" aria-label="Policy controls">
      <h2>Policy</h2>

      <div className="presets">
        {CLEANING_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={active?.id === p.id ? 'preset active' : 'preset'}
            aria-pressed={active?.id === p.id}
            onClick={() => onChange(applyPreset(controls, p))}
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="control">
        <span>
          Cleaning interval: <strong>{intervalLabel(controls.cleaningInterval)}</strong>
        </span>
        <input
          type="range"
          min={0}
          max={30}
          step={1}
          value={controls.cleaningInterval}
          onChange={(e) => set({ cleaningInterval: Number(e.target.value) })}
        />
      </label>

      <label className="control">
        <span>
          Household compliance: <strong>{`${percent}%`}</strong>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          onChange={(e) => set({ compliance: Number(e.target.value) / 100 })}
        />
      </label>
      {percent > 50 && (
        <p className="hint">
          Above the PHO estimate of 26-50%. This is a hypothetical value.
        </p>
      )}

      <label className="control inline">
        <input
          type="checkbox"
          checked={controls.foggingOn}
          onChange={(e) => set({ foggingOn: e.target.checked })}
        />
        <span>Fogging</span>
      </label>

      <label className={controls.foggingOn ? 'control' : 'control off'}>
        <span>
          Fogging trigger:{' '}
          <strong>
            {`${controls.foggingTrigger} reported ${controls.foggingTrigger === 1 ? 'case' : 'cases'} in 7 days`}
          </strong>
        </span>
        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={controls.foggingTrigger}
          disabled={!controls.foggingOn}
          onChange={(e) => set({ foggingTrigger: Number(e.target.value) })}
        />
      </label>

      <label className="control inline">
        <span>Number of runs</span>
        <input
          type="number"
          min={1}
          max={MAX_RUNS}
          step={1}
          value={controls.runs}
          onChange={(e) => set({ runs: Number(e.target.value) })}
        />
      </label>
    </section>
  )
}