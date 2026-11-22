// Talks to the simulation worker for the page: numbers each run, passes on progress,
// resolves with the finished result, rejects on an error, and handles Cancel.
// No browser code in here: the real Worker is made by a factory that the page gives in,
// so a test can give in a fake one.

import type { DoneReply, RunRequest, WorkerReply } from '../engine/runJob'

// What the client needs from a worker.
export interface WorkerHandle {
  send(request: RunRequest): void
  stop(): void
}

// Starts a worker. `onReply` gets every reply, `onFailure` is called if the worker itself breaks.
export type WorkerFactory = (
  onReply: (reply: WorkerReply) => void,
  onFailure: (message: string) => void,
) => WorkerHandle

// A request without the two fields the client fills in.
export type RunInput = Omit<RunRequest, 'type' | 'id'>

export class RunCancelled extends Error {
  constructor() {
    super('run cancelled')
    this.name = 'RunCancelled'
  }
}

export interface RunClient {
  run(input: RunInput, onProgress?: (daysDone: number, totalDays: number) => void): Promise<DoneReply>
  cancel(): void
  isBusy(): boolean
}

interface Pending {
  id: number
  resolve: (reply: DoneReply) => void
  reject: (error: Error) => void
  onProgress?: (daysDone: number, totalDays: number) => void
}

export function createRunClient(factory: WorkerFactory): RunClient {
  let handle: WorkerHandle | null = null
  let pending: Pending | null = null
  let nextId = 1

  // stops the worker; the next run starts a fresh one
  function drop(): void {
    handle?.stop()
    handle = null
  }

  function onReply(reply: WorkerReply): void {
    if (!pending || reply.id !== pending.id) return // a late reply of an older run
    if (reply.type === 'progress') {
      pending.onProgress?.(reply.daysDone, reply.totalDays)
      return
    }
    const current = pending
    pending = null
    if (reply.type === 'done') current.resolve(reply)
    else current.reject(new Error(reply.message))
  }

  function onFailure(message: string): void {
    drop()
    if (!pending) return
    const current = pending
    pending = null
    current.reject(new Error(message))
  }

  function startWorker(): WorkerHandle {
    let started: WorkerHandle | null = null
    // callbacks of a worker that was dropped are ignored
    started = factory(
      (reply) => {
        if (started === handle) onReply(reply)
      },
      (message) => {
        if (started === handle) onFailure(message)
      },
    )
    return started
  }

  return {
    run(input, onProgress) {
      if (pending) return Promise.reject(new Error('a run is already in progress'))
      const id = nextId++
      return new Promise<DoneReply>((resolve, reject) => {
        pending = { id, resolve, reject, onProgress }
        try {
          if (!handle) handle = startWorker()
          handle.send({ ...input, type: 'run', id })
        } catch (error) {
          pending = null
          drop()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      })
    },

    cancel() {
      drop()
      if (!pending) return
      const current = pending
      pending = null
      current.reject(new RunCancelled())
    },

    isBusy() {
      return pending !== null
    },
  }
}