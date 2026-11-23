// Holds the state of one run for the page (idle, running, done, cancelled, error),
// loads the settings once, builds the requests and calls the run client.
// A run is two engine runs with the same seed: the "do nothing" baseline (no cleaning,
// no fogging), which is kept and reused while the controls change, and the policy run.
// No React and no browser code in here, so a test can give in a fake client.

import type { Params } from '../engine/params'
import type { DoneReply } from '../engine/runJob'
import type { RunClient } from '../worker/runClient'
import { RunCancelled } from '../worker/runClient'
import type { Comparison } from './curve'
import { compareRuns } from './curve'
import type { PolicyControls } from './policyControls'
import { buildRunInput } from './runInput'

export type RunStatus = 'idle' | 'running' | 'done' | 'cancelled' | 'error'
export type RunPhase = 'baseline' | 'policy'

export interface RunState {
  status: RunStatus
  daysDone: number
  totalDays: number
  phase: RunPhase | null // which of the two runs is going while status is running
  message?: string
  result: DoneReply | null // the policy run
  comparison: Comparison | null // policy against the "do nothing" baseline
}

export interface RunController {
  getState(): RunState
  subscribe(listener: () => void): () => void
  start(controls: PolicyControls): Promise<void>
  cancel(): void
}

const IDLE: RunState = { status: 'idle', daysDone: 0, totalDays: 0, phase: null, result: null, comparison: null }

export function createRunController(
  client: RunClient,
  loadBase: () => Promise<Params>,
  makeSeed: () => number,
): RunController {
  let state: RunState = IDLE
  let base: Params | null = null
  let seed: number | null = null // made on the first start and kept, so the baseline stays valid
  let baseline: DoneReply | null = null // the "do nothing" run for this seed
  let token = 0 // a start or a cancel makes older runs stale
  const listeners = new Set<() => void>()

  // a new object each time, so the page can see that something changed
  function setState(next: RunState): void {
    state = next
    for (const listener of [...listeners]) listener()
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    async start(controls) {
      if (state.status === 'running') return
      const mine = ++token
      setState({ status: 'running', daysDone: 0, totalDays: 0, phase: null, result: null, comparison: null })
      try {
        base ??= await loadBase()
        if (mine !== token) return
        seed ??= makeSeed()
        const onProgress = (daysDone: number, totalDays: number) => {
          if (mine === token) setState({ ...state, daysDone, totalDays })
        }

        let reference = baseline
        if (reference === null) {
          setState({ ...state, phase: 'baseline', daysDone: 0, totalDays: 0 })
          const doNothing: PolicyControls = { ...controls, cleaningInterval: 0, foggingOn: false }
          reference = await client.run(buildRunInput(doNothing, base, seed), onProgress)
          if (mine !== token) return
          baseline = reference
        }

        setState({ ...state, phase: 'policy', daysDone: 0, totalDays: 0 })
        const reply = await client.run(buildRunInput(controls, base, seed), onProgress)
        if (mine !== token) return
        const comparison = compareRuns(reference.result, reply.result)
        setState({ ...state, status: 'done', phase: null, result: reply, comparison })
      } catch (error) {
        if (mine !== token) return
        if (error instanceof RunCancelled) {
          setState({ ...state, status: 'cancelled', phase: null })
        } else {
          const message = error instanceof Error ? error.message : String(error)
          setState({ ...state, status: 'error', phase: null, message })
        }
      }
    },

    cancel() {
      if (state.status !== 'running') return
      token++
      client.cancel()
      setState({ ...state, status: 'cancelled', phase: null })
    },
  }
}