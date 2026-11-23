import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../src/engine/params'
import type { Params } from '../src/engine/params'
import type { DoneReply } from '../src/engine/runJob'
import { DEFAULT_CONTROLS } from '../src/state/policyControls'
import { createRunController } from '../src/state/runController'
import { RunCancelled } from '../src/worker/runClient'
import type { RunClient, RunInput } from '../src/worker/runClient'

const reply = { type: 'done', id: 1, seconds: 1, result: {} } as unknown as DoneReply

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

const loadOk = () => Promise.resolve<Params>(DEFAULT_PARAMS)

describe('createRunController', () => {
  it('starts idle', () => {
    const c = createRunController(fakeClient().client, loadOk, () => 1)
    expect(c.getState().status).toBe('idle')
    expect(c.getState().result).toBeNull()
  })

  it('runs: running, then done with the result', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 1)
    const started = c.start(DEFAULT_CONTROLS)
    expect(c.getState().status).toBe('running')
    await flush()
    fake.finish(reply)
    await started
    expect(c.getState().status).toBe('done')
    expect(c.getState().result).toBe(reply)
  })

  it('builds the request from the controls, the loaded settings and the seed', async () => {
    const fake = fakeClient()
    const c = createRunController(fake.client, loadOk, () => 42)
    void c.start({ ...DEFAULT_CONTROLS, cleaningInterval: 3, compliance: 0.75, foggingOn: false, foggingTrigger: 5 })
    await flush()
    expect(fake.inputs).toHaveLength(1)
    const input = fake.inputs[0]
    expect(input.seed).toBe(42)
    expect(input.cleaningIntervalDays).toBe(3)
    expect(input.foggingOn).toBe(false)
    expect(input.foggingTrigger).toBe(5)
    expect(input.params.compliance).toBe(0.75)
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
    await flush()
    fake.finish(reply)
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
    await flush()
    fake.finish(reply)
    await first
    const second = c.start(DEFAULT_CONTROLS)
    await flush()
    fake.finish(reply)
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
    expect(fake.cancels()).toBe(1)
    fake.finish(reply)
    await flush()
    expect(c.getState().status).toBe('cancelled')
    expect(c.getState().result).toBeNull()
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