import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../src/engine/params'
import type { Params } from '../src/engine/params'
import type { DoneReply } from '../src/engine/runJob'
import { DEFAULT_CONTROLS } from '../src/state/policyControls'
import { createRunController } from '../src/state/runController'
import { RunCancelled } from '../src/worker/runClient'
import type { RunClient, RunInput } from '../src/worker/runClient'

// a small fake result: 14 days, 1 municipality, `total` mosquito infections on day 0 (all in
// municipality 0), no imports, 10 people, `adults` adult mosquitoes and twice as many immatures every day,
// and 2 households with 2 snapshots (day 0 and day 7), every household in state `state`
function makeReply(total: number, adults = 70, state = 0): DoneReply {
  const days = 14
  const households = 2
  const newInfections = new Int32Array(days)
  newInfections[0] = total
  const biteInfections = new Int32Array(days)
  biteInfections[0] = total
  return {
    type: 'done',
    id: 1,
    seconds: 1,
    result: {
      days,
      municipalityCount: 1,
      householdCount: households,
      newInfections,
      imported: new Int32Array(days),
      biteInfections,
      adults: new Int32Array(days).fill(adults),
      immatures: new Int32Array(days).fill(adults * 2),
      susceptible: new Int32Array(days).fill(10),
      exposed: new Int32Array(days),
      infectious: new Int32Array(days),
      recovered: new Int32Array(days),
      householdStates: new Uint8Array(Math.ceil(days / 7) * households).fill(state),
    },
  } as unknown as DoneReply
}

const baselineReply = makeReply(10)
const reply = makeReply(5)

// lets the controller get past its awaits
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function fakeClient() {
  let resolve: (r: DoneReply) => void = () => {}
  let reject: (e: Error) => void = () => {}
  let progress: ((daysDone: number, totalDays: number) => void) | undefined
  const inputs: RunInput[] = []
  let cancels = 0
  const client: RunClient = {
    run(input, onProgress) {
      inputs.push(input)
      progress = onProgress
      return new Promise<DoneReply>((res, rej) => {
        resolve = res
        reject = rej
      })
    },
    cancel() {
      cancels++
      reject(new RunCancelled())
    },
    isBusy: () => false,
  }
  return {
    client,
    inputs,
    cancels: () => cancels,
    finish: (r: DoneReply) => resolve(r),
    fail: (message: string) => reject(new Error(message)),
    report: (d: number, t: number) => progress?.(d, t),
  }
}

type Fake = ReturnType<typeof fakeClient>

// finishes the engine runs one after another (the baseline first, then the policy run)
async function finishRuns(fake: Fake, ...replies: DoneReply[]) {
  for (const r of replies) {
    await flush()
    fake.finish(r)
  }
}

const loadOk = () => Promise.resolve<Params>(DEFAULT_PARAMS)

describe('createRunController', () => {
  it('starts idle', () => {
    const c = createRunController(fakeClient().client, loadOk, () => 1)
    expect(c.getState().status).toBe('idle')
    expect(c.getState().result).toBeNull()
    expect(c.getState().comparison).toBeNull()
    expect(c.getState().phase).toBeNull()
  })

  it('runs: running, then done with the policy result', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    const started = c.start(DEFAULT_CONTROLS)
    expect(c.getState().status).toBe('running')
    await finishRuns(fake, baselineReply, reply)
    await started
    expect(c.getState().status).toBe('done')
    expect(c.getState().result).toBe(reply)
    expect(c.getState().phase).toBeNull()
  })

  it('runs the baseline first, then the policy run, and says which phase is going', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    const started = c.start(DEFAULT_CONTROLS)
    await flush()
    expect(c.getState().phase).toBe('baseline')
    fake.finish(baselineReply)
    await flush()
    expect(c.getState().phase).toBe('policy')
    fake.finish(reply)
    await started
    expect(fake.inputs).toHaveLength(2)
  })

  it('the baseline has no cleaning and no fogging, and shares the seed with the policy run', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 42)
    const started = c.start({ ...DEFAULT_CONTROLS, cleaningInterval: 3, foggingOn: true })
    await finishRuns(fake, baselineReply, reply)
    await started
    const [baselineInput, policyInput] = fake.inputs
    expect(baselineInput.cleaningIntervalDays).toBe(0)
    expect(baselineInput.foggingOn).toBe(false)
    expect(baselineInput.seed).toBe(42)
    expect(policyInput.cleaningIntervalDays).toBe(3)
    expect(policyInput.foggingOn).toBe(true)
    expect(policyInput.seed).toBe(42)
  })

  it('builds the policy request from the controls, the loaded settings and the seed', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 42)
    void c.start({ ...DEFAULT_CONTROLS, cleaningInterval: 3, compliance: 0.75, foggingOn: false, foggingTrigger: 5 })
    await finishRuns(fake, baselineReply)
    await flush()
    expect(fake.inputs).toHaveLength(2)
    const input = fake.inputs[1]
    expect(input.seed).toBe(42)
    expect(input.cleaningIntervalDays).toBe(3)
    expect(input.foggingOn).toBe(false)
    expect(input.foggingTrigger).toBe(5)
    expect(input.params.compliance).toBe(0.75)
  })

  it('compares the policy run with the baseline', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    const started = c.start(DEFAULT_CONTROLS)
    await finishRuns(fake, baselineReply, reply)
    await started
    const comparison = c.getState().comparison
    expect(comparison).not.toBeNull()
    expect(comparison?.baselineTotal).toBe(10)
    expect(comparison?.policyTotal).toBe(5)
    expect(comparison?.percentReduction).toBe(50)
  })

  it('also compares the mosquitoes per person, adults and immatures, for both runs', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    const started = c.start(DEFAULT_CONTROLS)
    await finishRuns(fake, makeReply(10, 80), makeReply(5, 30))
    await started
    const comparison = c.getState().comparison
    expect(comparison?.baselineAdultsPerPerson).toEqual([8, 8])
    expect(comparison?.policyAdultsPerPerson).toEqual([3, 3])
    expect(comparison?.baselineImmaturesPerPerson).toEqual([16, 16])
    expect(comparison?.policyImmaturesPerPerson).toEqual([6, 6])
  })

  it('also gives the bite infections per municipality for both runs', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    const started = c.start(DEFAULT_CONTROLS)
    await finishRuns(fake, makeReply(10), makeReply(5))
    await started
    const comparison = c.getState().comparison
    expect(comparison?.baselineBitesByMunicipality).toEqual([10])
    expect(comparison?.policyBitesByMunicipality).toEqual([5])
  })

  it('also gives the household states of both runs and the number of households', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    const started = c.start(DEFAULT_CONTROLS)
    // the baseline has every household in state 2 (infectious), the policy run in state 1 (exposed)
    await finishRuns(fake, makeReply(10, 70, 2), makeReply(5, 70, 1))
    await started
    const comparison = c.getState().comparison
    expect(comparison?.householdCount).toBe(2)
    expect(Array.from(comparison?.baselineHouseholdStates ?? [])).toEqual([2, 2, 2, 2])
    expect(Array.from(comparison?.policyHouseholdStates ?? [])).toEqual([1, 1, 1, 1])
  })

  it('reuses the baseline and the seed on the next start, so only the policy run is new', async () => {
    const fake = fakeClient()
    let seeds = 0
    const c = createRunController(fake.client, loadOk, () => ++seeds)
    const first = c.start(DEFAULT_CONTROLS)
    await finishRuns(fake, baselineReply, reply)
    await first
    const second = c.start({ ...DEFAULT_CONTROLS, cleaningInterval: 3 })
    await finishRuns(fake, makeReply(2))
    await second
    expect(fake.inputs).toHaveLength(3)
    expect(fake.inputs[2].cleaningIntervalDays).toBe(3)
    expect(fake.inputs[2].seed).toBe(1)
    expect(seeds).toBe(1)
    expect(c.getState().status).toBe('done')
    expect(c.getState().comparison?.percentReduction).toBe(80)
  })

  it('passes progress into the state', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    void c.start(DEFAULT_CONTROLS)
    await flush()
    fake.report(300, 2000)
    expect(c.getState().daysDone).toBe(300)
    expect(c.getState().totalDays).toBe(2000)
    expect(c.getState().status).toBe('running')
  })

  it('an error reply gives status error with the message', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    const started = c.start(DEFAULT_CONTROLS)
    await flush()
    fake.fail('boom')
    await started
    expect(c.getState().status).toBe('error')
    expect(c.getState().message).toBe('boom')
  })

  it('a failed baseline is not kept, so the next start runs the baseline again', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    const first = c.start(DEFAULT_CONTROLS)
    await flush()
    fake.fail('boom')
    await first
    const second = c.start(DEFAULT_CONTROLS)
    await finishRuns(fake, baselineReply, reply)
    await second
    expect(fake.inputs).toHaveLength(3)
    expect(fake.inputs[1].cleaningIntervalDays).toBe(0)
    expect(c.getState().status).toBe('done')
  })

  it('a settings load failure gives status error, and the next start tries again', async () => {
    const fake = fakeClient()
    let calls = 0
    const load = () => {
      calls++
      return calls === 1 ? Promise.reject(new Error('no settings')) : Promise.resolve<Params>(DEFAULT_PARAMS)
    }
    const c = createRunController(fake.client, load, () => 1)
    await c.start(DEFAULT_CONTROLS)
    expect(c.getState().status).toBe('error')
    expect(c.getState().message).toBe('no settings')
    const second = c.start(DEFAULT_CONTROLS)
    await finishRuns(fake, baselineReply, reply)
    await second
    expect(c.getState().status).toBe('done')
    expect(calls).toBe(2)
  })

  it('loads the settings only once', async () => {
    const fake = fakeClient()
    let calls = 0
    const load = () => {
      calls++
      return Promise.resolve<Params>(DEFAULT_PARAMS)
    }
    const c = createRunController(fake.client, load, () => 1)
    const first = c.start(DEFAULT_CONTROLS)
    await finishRuns(fake, baselineReply, reply)
    await first
    const second = c.start(DEFAULT_CONTROLS)
    await finishRuns(fake, reply)
    await second
    expect(calls).toBe(1)
  })

  it('ignores a start while a run is going', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    void c.start(DEFAULT_CONTROLS)
    await flush()
    await c.start(DEFAULT_CONTROLS)
    expect(fake.inputs).toHaveLength(1)
  })

  it('cancel gives status cancelled, stops the client, and a late result is ignored', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    const started = c.start(DEFAULT_CONTROLS)
    await flush()
    c.cancel()
    await started
    expect(c.getState().status).toBe('cancelled')
    expect(c.getState().phase).toBeNull()
    expect(fake.cancels()).toBe(1)
    fake.finish(reply)
    await flush()
    expect(c.getState().status).toBe('cancelled')
    expect(c.getState().result).toBeNull()
    expect(c.getState().comparison).toBeNull()
  })

  it('cancel during the baseline starts no policy run', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    const started = c.start(DEFAULT_CONTROLS)
    await flush()
    c.cancel()
    await started
    await flush()
    expect(fake.inputs).toHaveLength(1)
  })

  it('cancel during the policy run keeps the baseline for the next start', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    const first = c.start(DEFAULT_CONTROLS)
    await finishRuns(fake, baselineReply)
    await flush()
    c.cancel()
    await first
    expect(c.getState().status).toBe('cancelled')
    const second = c.start(DEFAULT_CONTROLS)
    await finishRuns(fake, reply)
    await second
    expect(fake.inputs).toHaveLength(3)
    expect(c.getState().status).toBe('done')
    expect(c.getState().comparison?.percentReduction).toBe(50)
  })

  it('cancel while the settings are still loading starts no run', async () => {
    const fake = fakeClient()
    let release: (p: Params) => void = () => {}
    const load = () =>
      new Promise<Params>((resolve) => {
        release = resolve
      })
    const c = createRunController(fake.client, load, () => 1)
    const started = c.start(DEFAULT_CONTROLS)
    c.cancel()
    release(DEFAULT_PARAMS)
    await started
    expect(c.getState().status).toBe('cancelled')
    expect(fake.inputs).toHaveLength(0)
  })

  it('cancel does nothing when no run is going', () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    c.cancel()
    expect(c.getState().status).toBe('idle')
    expect(fake.cancels()).toBe(0)
  })

  it('tells listeners about changes, and stops after unsubscribe', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    let calls = 0
    const unsubscribe = c.subscribe(() => {
      calls++
    })
    void c.start(DEFAULT_CONTROLS)
    expect(calls).toBe(1)
    unsubscribe()
    await flush()
    fake.report(30, 2000)
    expect(calls).toBe(1)
  })
})