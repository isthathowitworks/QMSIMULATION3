// One run request, handled the same way inside the worker and inside tests.
// The worker file (next step) only receives messages, calls runJob and posts the replies.
// Cancel is done by the app: it stops the worker, and the next run starts a fresh one.

import type { World } from './population'
import type { Weather } from './weather'
import type { PolicyFile } from './policyData'
import type { Params } from './params'
import type { RunResult } from './run'
import { buildPolicyArrays } from './policyData'
import { runSimulation } from './run'

// App -> worker
export interface RunRequest {
  type: 'run'
  id: number // the app numbers its runs so it can tell the replies apart
  params: Params // all slider values (the copy the person has changed)
  seed: number // whole number; a different seed gives a different run
  cleaningIntervalDays?: number // same for every municipality; 0 = no cleaning; leave out to use policy.json
  foggingOn?: boolean // default true; false = no fogging at all
  foggingTrigger?: number // reported cases in 7 days, same for every municipality; leave out to use policy.json
}

// Worker -> app
export interface ProgressReply {
  type: 'progress'
  id: number
  daysDone: number
  totalDays: number
}
export interface DoneReply {
  type: 'done'
  id: number
  seconds: number // how long the run took
  result: RunResult
}
export interface ErrorReply {
  type: 'error'
  id: number
  message: string
}
export type WorkerReply = ProgressReply | DoneReply | ErrorReply

// The data the worker loads once and keeps for every run.
export interface EngineData {
  world: World
  weather: Weather
  policyFile: PolicyFile
}

// Returns a plain-language problem with the request, or null when it is fine.
export function checkRequest(req: RunRequest): string | null {
  if (!Number.isInteger(req.seed)) return 'seed must be a whole number'
  if (!(req.params.compliance >= 0 && req.params.compliance <= 1)) {
    return 'compliance must be between 0 and 1'
  }
  const interval = req.cleaningIntervalDays
  if (interval !== undefined && !(Number.isInteger(interval) && interval >= 0)) {
    return 'cleaning interval must be a whole number of days, 0 or more'
  }
  const trigger = req.foggingTrigger
  if (trigger !== undefined && !(Number.isInteger(trigger) && trigger >= 0)) {
    return 'fogging trigger must be a whole number, 0 or more'
  }
  return null
}

// The memory blocks inside a result (15 of them). Handing these over (instead of copying them)
// makes sending a result back from the worker instant.
export function transferables(r: RunResult): ArrayBuffer[] {
  const arrays = [
    r.adults, r.immatures, r.infectiousAdults, r.cleanings, r.newInfections, r.imported,
    r.susceptible, r.exposed, r.infectious, r.recovered,
    r.biteInfections, r.onsets, r.fogged, r.foggingRounds,
    r.householdStates,
  ]
  return arrays.map((a) => a.buffer as ArrayBuffer)
}

// Runs one request. Everything goes out through `post`: progress messages while it runs,
// then one `done` (with the result handed over) or one `error`.
export function runJob(
  data: EngineData,
  request: RunRequest,
  post: (reply: WorkerReply, transfer?: ArrayBuffer[]) => void,
): void {
  const id = request.id
  try {
    const problem = checkRequest(request)
    if (problem) {
      post({ type: 'error', id, message: problem })
      return
    }

    // fogging off means nobody is reached; the request's own params are left alone
    const params: Params =
      request.foggingOn === false ? { ...request.params, fogCoverage: 0 } : request.params

    const policy = buildPolicyArrays(data.world, data.policyFile)
    if (request.cleaningIntervalDays !== undefined) {
      policy.intervals.fill(request.cleaningIntervalDays)
    }
    if (request.foggingTrigger !== undefined) {
      policy.foggingTrigger.fill(request.foggingTrigger)
    }
    const compliance = new Float64Array(policy.intervals.length).fill(params.compliance)

    const t0 = performance.now()
    const result = runSimulation(
      data.world, data.weather, policy, data.policyFile.centroids, compliance, params, request.seed,
      (daysDone, totalDays) => post({ type: 'progress', id, daysDone, totalDays }),
    )
    const seconds = (performance.now() - t0) / 1000
    post({ type: 'done', id, seconds, result }, transferables(result))
  } catch (error) {
    post({ type: 'error', id, message: error instanceof Error ? error.message : String(error) })
  }
}