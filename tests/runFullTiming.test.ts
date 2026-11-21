// Temporary timing test for 2.8. Skipped unless TIMING is set, so npm test ignores it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runSimulation } from '../src/engine/run'
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

const YEAR_DAYS = [365, 366, 365, 365, 365, 366, 365] // 2019 to 2025

describe.skipIf(!process.env.TIMING)('runSimulation on the real data', () => {
  it('runs 2019 to 2025 with disease and reports the time taken', () => {
    const world = buildWorld(readJson<PopulationFile>('public/data/population.json'))
    const weather = buildWeather(readJson<WeatherFile>('public/data/weather.json'))
    const policyFile = readJson<PolicyFile>('public/data/policy.json')
    const policy = buildPolicyArrays(world, policyFile)
    const compliance = new Float64Array(policy.intervals.length).fill(DEFAULT_PARAMS.compliance)

    const t0 = performance.now()
    const r = runSimulation(world, weather, policy, policyFile.centroids, compliance, DEFAULT_PARAMS, 1)
    const seconds = (performance.now() - t0) / 1000

    const M = r.municipalityCount
    const people = world.personHousehold.length
    const factor = DEFAULT_PARAMS.scale * DEFAULT_PARAMS.reportFrac

    // reported cases per year (rough, the model is not fitted yet)
    const perYear: string[] = []
    let day = 0
    for (let y = 0; y < YEAR_DAYS.length; y++) {
      let onsets = 0
      for (let d = day; d < day + YEAR_DAYS[y]; d++) {
        for (let k = 0; k < M; k++) onsets += r.onsets[d * M + k]
      }
      perYear.push(`${2019 + y}: ${Math.round(onsets * factor)}`)
      day += YEAR_DAYS[y]
    }

    let infections = 0
    let imported = 0
    let peakInfectious = 0
    for (let d = 0; d < r.days; d++) {
      infections += r.newInfections[d]
      imported += r.imported[d]
      if (r.infectious[d] > peakInfectious) peakInfectious = r.infectious[d]
    }
    let rounds = 0
    for (const v of r.foggingRounds) rounds += v

    console.log(
      `Full run: ${seconds.toFixed(1)} s\n` +
        `New infections: ${infections} (imported ${imported}), peak infectious people: ${peakInfectious} of ${people}\n` +
        `Reported cases per year: ${perYear.join(' | ')}\n` +
        `Fogging rounds, all municipalities: ${rounds}`,
    )

    expect(r.days).toBe(2557)
    expect(r.susceptible[2556] + r.exposed[2556] + r.infectious[2556] + r.recovered[2556]).toBe(people)
  }, 600000)
})
