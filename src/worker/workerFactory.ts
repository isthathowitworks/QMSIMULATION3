// Creates the real simulation Web Worker for the run client.
// Browser code: not tested by Vitest, checked by tsc and used for real in the page.

import type { WorkerReply } from '../engine/runJob'
import type { WorkerFactory } from './runClient'

export const createSimWorker: WorkerFactory = (onReply, onFailure) => {
  const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<WorkerReply>) => onReply(event.data)
  worker.onerror = (event) => onFailure(event.message || 'the worker stopped')
  worker.onmessageerror = () => onFailure('the worker sent a message that could not be read')
  return {
    send: (request) => worker.postMessage(request),
    stop: () => worker.terminate(),
  }
}