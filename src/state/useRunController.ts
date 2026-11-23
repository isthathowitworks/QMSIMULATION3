// Gives the page one run controller and re-renders it when the run state changes.
// The real worker is only started when a run starts, not when the page loads.

import { useEffect, useState, useSyncExternalStore } from 'react'
import { createSimWorker } from '../worker/workerFactory'
import { createRunClient } from '../worker/runClient'
import type { PolicyControls } from './policyControls'
import { loadParams } from './loadParams'
import { createRunController } from './runController'
import type { RunState } from './runController'

// A whole number, as the engine asks for.
function makeSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000)
}

export interface UseRunController {
  state: RunState
  start: (controls: PolicyControls) => void
  cancel: () => void
}

// `baseUrl` is import.meta.env.BASE_URL, given in by App.tsx.
export function useRunController(baseUrl: string): UseRunController {
  const [controller] = useState(() =>
    createRunController(createRunClient(createSimWorker), () => loadParams(baseUrl), makeSeed),
  )
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)

  // leaving the page stops a run that is still going
  useEffect(() => () => controller.cancel(), [controller])

  return {
    state,
    start: (controls) => {
      void controller.start(controls)
    },
    cancel: () => controller.cancel(),
  }
}