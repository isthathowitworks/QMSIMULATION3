import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runMosquitoes } from '../src/engine/mosquitoRun'
import { buildWeather } from '../src/engine/weather'
import type { WeatherFile } from '../src/engine/weather'
import { buildWorld } from '../src/engine/population'
import type { PopulationFile } from '../src/engine/population'
import { buildPolicyArrays } from '../src/engine/policyData'
import type { PolicyFile } from '../src/engine/policyData'
import { DEFAULT_PARAMS } from '../src/engine/params'

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf-8')) as T
}

describe('runMosquitoes on the real data', () => {
  it('runs 2019 to 2025 and reports the time taken', () => {
    const world = buildWorld(readJson<PopulationFile>('public/data/population.json'))
    const weather = buildWeather(readJson<WeatherFile>('public/data/weather.json'))
    const { intervals } = buildPolicyArrays(world, readJson<PolicyFile>('public/data/policy.json'))
    const compliance = new Float64Array(intervals.length).fill(DEFAULT_PARAMS.compliance)

    const t0 = performance.now()
    const r = runMosquitoes(world, weather, intervals, compliance, DEFAULT_PARAMS, 1)
    const seconds = (performance.now() - t0) / 1000

    let sum = 0
    let min = Infinity
    let max = 0
    for (const v of r.adults) {
      sum += v
      if (v < min) min = v
      if (v > max) max = v
    }
    const people = world.personHousehold.length
    console.log(
      `Real run: ${seconds.toFixed(1)} s | adults per person: min ${(min / people).toFixed(2)}, ` +
        `mean ${(sum / r.adults.length / people).toFixed(2)}, max ${(max / people).toFixed(2)}`,
    )

    expect(r.adults.length).toBe(2557)
    expect(r.cleanings.length).toBe(2557)
    expect(min).toBeGreaterThan(0)
  }, 300000)
})