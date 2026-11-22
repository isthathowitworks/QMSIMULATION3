// The main controls of the app as one plain object, plus the cleaning presets.
// No React in here, so it can be tested on its own.

export interface PolicyControls {
  cleaningInterval: number // days between cleanings, 1 to 30; 0 = no cleaning
  compliance: number // share of due households that really clean, 0 to 1
  foggingOn: boolean
  foggingTrigger: number // reported cases in 7 days needed to fog, 1 to 20
  runs: number // number of runs to average, 1 to MAX_RUNS
}

export const MAX_RUNS = 10

// starting position of the controls (the real policy: waste collection every 7 days,
// fogging at 1 case; compliance 50% is the top of the PHO's 26-50% estimate)
export const DEFAULT_CONTROLS: PolicyControls = {
  cleaningInterval: 7,
  compliance: 0.5,
  foggingOn: true,
  foggingTrigger: 1,
  runs: 1,
}

export interface CleaningPreset {
  id: string
  label: string
  cleaningInterval: number
  compliance: number
}

export const CLEANING_PRESETS: CleaningPreset[] = [
  { id: 'none', label: 'No cleaning', cleaningInterval: 0, compliance: 0 },
  { id: 'weekly-low', label: 'Weekly, low compliance', cleaningInterval: 7, compliance: 0.26 },
  { id: 'weekly-moderate', label: 'Weekly, moderate compliance', cleaningInterval: 7, compliance: 0.5 },
  { id: 'weekly-high', label: 'Weekly, high compliance', cleaningInterval: 7, compliance: 0.75 },
  { id: 'frequent', label: 'Frequent', cleaningInterval: 3, compliance: 0.5 },
  { id: 'infrequent', label: 'Infrequent', cleaningInterval: 14, compliance: 0.5 },
]

// A preset sets only cleaning interval and compliance; fogging and runs stay as they are.
export function applyPreset(controls: PolicyControls, preset: CleaningPreset): PolicyControls {
  return {
    ...controls,
    cleaningInterval: preset.cleaningInterval,
    compliance: preset.compliance,
  }
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

// Keeps every control inside its allowed range (a bad value falls back to the starting position).
export function clampControls(c: PolicyControls): PolicyControls {
  return {
    cleaningInterval: clampInt(c.cleaningInterval, 0, 30, DEFAULT_CONTROLS.cleaningInterval),
    compliance: Number.isFinite(c.compliance)
      ? Math.min(1, Math.max(0, c.compliance))
      : DEFAULT_CONTROLS.compliance,
    foggingOn: c.foggingOn === true,
    foggingTrigger: clampInt(c.foggingTrigger, 1, 20, DEFAULT_CONTROLS.foggingTrigger),
    runs: clampInt(c.runs, 1, MAX_RUNS, DEFAULT_CONTROLS.runs),
  }
}

// The preset the controls currently match, or null if none does.
export function matchingPreset(controls: PolicyControls): CleaningPreset | null {
  return (
    CLEANING_PRESETS.find(
      (p) => p.cleaningInterval === controls.cleaningInterval && p.compliance === controls.compliance,
    ) ?? null
  )
}