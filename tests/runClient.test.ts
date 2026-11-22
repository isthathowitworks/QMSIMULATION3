import { describe, it, expect } from 'vitest'
import { createRunClient, RunCancelled } from '../src/worker/runClient'
import type { WorkerFactory } from '../src/worker/runClient'
import type { RunRequest, WorkerReply } from '../src/engine/runJob'
import type { RunResult } from '../src/engine/run'
import { DEFAULT_PARAMS } from '../src/engine/params'

// A fake worker factory: records what is sent, and lets the test send replies by hand.
function makeFake() {
  const sent: RunRequest[] = []
  const workers: { reply: (r: WorkerReply) => void; fail: (m: string) => void }[] = []
  let stopped = 0
  const factory: WorkerFactory = (onReply, onFailure) => {
    workers.push({ reply: onReply, fail: onFailure })
    return {
      send: (request) => {
        sent.push(request)
      },
      stop: () => {
        stopped++
      },
    }
  }
  return {
    factory,
    sent,
    created: () => workers.length,
    stopped: () => stopped,
    reply: (worker: number, r: WorkerReply) => workers[worker].reply(r),
    fail: (worker: number, message: string) => workers[worker].fail(message),
  }
}

const input = { params: DEFAULT_PARAMS, seed: 1 }
const done = (id: number): WorkerReply => ({ type: 'done', id, seconds: 1.5, result: {} as RunResult })

describe('run client', () => {
  it('sends the request with a type and a numbered id', async () => {
    const fake = makeFake()
    const client = createRunClient(fake.factory)
    const p = client.run({ ...input, seed: 7, cleaningIntervalDays: 3 })
    expect(fake.sent).toHaveLength(1)
    expect(fake.sent[0]).toMatchObject({ type: 'run', id: 1, seed: 7, cleaningIntervalDays: 3 })
    fake.reply(0, done(1))
    await p
    const p2 = client.run(input)
    expect(fake.sent[1].id).toBe(2)
    fake.reply(0, done(2))
    await p2
  })

  it('passes on progress and resolves with the done reply', async () => {
    const fake = makeFake()
    const client = createRunClient(fake.factory)
    const seen: number[] = []
    const p = client.run(input, (daysDone) => seen.push(daysDone))
    fake.reply(0, { type: 'progress', id: 1, daysDone: 30, totalDays: 100 })
    fake.reply(0, { type: 'progress', id: 1, daysDone: 60, totalDays: 100 })
    fake.reply(0, done(1))
    const reply = await p
    expect(seen).toEqual([30, 60])
    expect(reply.seconds).toBe(1.5)
  })

  it('rejects with the message of an error reply', async () => {
    const fake = makeFake()
    const client = createRunClient(fake.factory)
    const p = client.run(input)
    fake.reply(0, { type: 'error', id: 1, message: 'compliance must be between 0 and 1' })
    await expect(p).rejects.toThrow('compliance must be between 0 and 1')
    expect(client.isBusy()).toBe(false)
  })

  it('is busy while a run is going, and ignores replies with another id', async () => {
    const fake = makeFake()
    const client = createRunClient(fake.factory)
    expect(client.isBusy()).toBe(false)
    const p = client.run(input)
    expect(client.isBusy()).toBe(true)
    fake.reply(0, done(99))
    expect(client.isBusy()).toBe(true)
    fake.reply(0, done(1))
    await p
    expect(client.isBusy()).toBe(false)
  })

  it('refuses a second run while one is going', async () => {
    const fake = makeFake()
    const client = createRunClient(fake.factory)
    const p = client.run(input)
    await expect(client.run(input)).rejects.toThrow('already in progress')
    fake.reply(0, done(1))
    await p
  })

  it('keeps the same worker for the next run', async () => {
    const fake = makeFake()
    const client = createRunClient(fake.factory)
    const p = client.run(input)
    fake.reply(0, done(1))
    await p
    const p2 = client.run(input)
    fake.reply(0, done(2))
    await p2
    expect(fake.created()).toBe(1)
  })

  it('cancel rejects the run, stops the worker, and the next run uses a fresh one', async () => {
    const fake = makeFake()
    const client = createRunClient(fake.factory)
    const p = client.run(input)
    client.cancel()
    await expect(p).rejects.toBeInstanceOf(RunCancelled)
    expect(fake.stopped()).toBe(1)
    expect(client.isBusy()).toBe(false)
    const p2 = client.run(input)
    expect(fake.created()).toBe(2)
    fake.reply(1, done(2))
    await p2
  })

  it('cancel with nothing running does nothing bad', () => {
    const client = createRunClient(makeFake().factory)
    expect(() => client.cancel()).not.toThrow()
  })

  it('a worker that breaks rejects the run, and the next run uses a fresh worker', async () => {
    const fake = makeFake()
    const client = createRunClient(fake.factory)
    const p = client.run(input)
    fake.fail(0, 'the worker stopped')
    await expect(p).rejects.toThrow('the worker stopped')
    const p2 = client.run(input)
    expect(fake.created()).toBe(2)
    fake.reply(1, done(2))
    await p2
  })

  it('ignores a late failure from a worker that was cancelled', async () => {
    const fake = makeFake()
    const client = createRunClient(fake.factory)
    const p = client.run(input)
    client.cancel()
    await expect(p).rejects.toBeInstanceOf(RunCancelled)
    const p2 = client.run(input)
    fake.fail(0, 'late failure of the old worker')
    expect(client.isBusy()).toBe(true)
    fake.reply(1, done(2))
    await p2
  })
})