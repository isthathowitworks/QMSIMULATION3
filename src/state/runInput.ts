// Turns the control values into one run request for the worker.
// "runs" is not used here: averaging several runs comes in a later step.

import type { Params } from '../engine/params'
import type { RunInput } from '../worker/runClient'
import type { PolicyControls } from './policyControls'

// `base` is the engine settings (starting positions with settings.json laid over them).
// The compliance slider replaces the base compliance; the base object is left unchanged.
export function buildRunInput(controls: PolicyControls, base: Params, seed: number): RunInput {
  return {
    params: { ...base, compliance: controls.compliance },
    seed,
    cleaningIntervalDays: controls.cleaningInterval,
    foggingOn: controls.foggingOn,
    foggingTrigger: controls.foggingTrigger,
  }
}