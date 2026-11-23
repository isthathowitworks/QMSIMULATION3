// Holds the state of one run for the page (idle, running, done, cancelled, error),
// loads the settings once, builds the request and calls the run client.
// No React and no browser code in here, so a test can give in a fake client.

import type { Params } from '../engine/params'
import type { DoneReply } from '../engine/runJob'
import type { RunClient } from '../worker/runClient'
import { RunCancelled } from '../worker/runClient'
import type { PolicyControls } from './policyControls'
import { buildRunInput } from './runInput'

export type RunStatus = 'idle' | 'running' | 'done' | 'cancelled' | 'error'

export interface RunState {
  status: RunStatus
  daysDone: number
  totalDays: number
  message?: string
  result: DoneReply | null
}

export interface RunController {
  getState(): RunState
  subscribe(listener: () => void): () => void
  start(controls: PolicyControls): Promise<void>
  cancel(): void
}

const IDLE: RunState = { status: 'idle', daysDone: 0, totalDays: 0, result: null }

export function createRunController(
  client: RunClient,
  loadBase: () => Promise<Params>,
  makeSeed: () => number,
): RunController {
  let state: RunState = IDLE
  let base: Params | null = null
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
      setState({ status: 'running', daysDone: 0, totalDays: 0, result: null })
      try {
        base ??= await loadBase()
        if (mine !== token) return
        const reply = await client.run(buildRunInput(controls, base, makeSeed()), (daysDone, totalDays) => {
          if (mine === token) setState({ ...state, daysDone, totalDays })
        })
        if (mine !== token) return
        setState({ ...state, status: 'done', result: reply })
      } catch (error) {
        if (mine !== token) return
        if (error instanceof RunCancelled) {
          setState({ ...state, status: 'cancelled' })
        } else {
          const message = error instanceof Error ? error.message : String(error)
          setState({ ...state, status: 'error', message })
        }
      }
    },

    cancel() {
      if (state.status !== 'running') return
      token++
      client.cancel()
      setState({ ...state, status: 'cancelled' })
    },
  }
}