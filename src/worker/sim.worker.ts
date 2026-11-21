// The simulation worker. It only receives messages and sends replies.
// All the real work is in src/engine/runJob.ts, which is tested.

import { buildWorld } from '../engine/population'
import type { PopulationFile } from '../engine/population'
import { buildWeather } from '../engine/weather'
import type { WeatherFile } from '../engine/weather'
import type { PolicyFile } from '../engine/policyData'
import { runJob } from '../engine/runJob'
import type { EngineData, RunRequest, WorkerReply } from '../engine/runJob'

async function loadJson<T>(name: string): Promise<T> {
  const url = `${import.meta.env.BASE_URL}data/${name}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`could not load ${url} (status ${response.status})`)
  return (await response.json()) as T
}

// The data is loaded once, on the first run, and kept for every later run.
let dataPromise: Promise<EngineData> | null = null

function loadData(): Promise<EngineData> {
  if (!dataPromise) {
    dataPromise = Promise.all([
      loadJson<PopulationFile>('population.json'),
      loadJson<WeatherFile>('weather.json'),
      loadJson<PolicyFile>('policy.json'),
    ]).then(([population, weatherFile, policyFile]) => ({
      world: buildWorld(population),
      weather: buildWeather(weatherFile),
      policyFile,
    }))
    // if loading failed, the next run tries again instead of keeping the failure
    dataPromise.catch(() => {
      dataPromise = null
    })
  }
  return dataPromise
}

function post(reply: WorkerReply, transfer: ArrayBuffer[] = []): void {
  self.postMessage(reply, { transfer })
}

self.onmessage = async (event: MessageEvent<RunRequest>) => {
  const request = event.data
  if (request.type !== 'run') return
  try {
    const data = await loadData()
    runJob(data, request, post)
  } catch (error) {
    post({
      type: 'error',
      id: request.id,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}