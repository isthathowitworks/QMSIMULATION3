// Temporary timing test for 2.8: times each step of the day separately.
// Skipped unless TIMING is set, so npm test ignores it.
import { describe, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildWeather } from '../src/engine/weather'
import type { WeatherFile } from '../src/engine/weather'
import { buildWorld, SUSCEPTIBLE, EXPOSED, INFECTIOUS, RECOVERED } from '../src/engine/population'
import type { PopulationFile, World } from '../src/engine/population'
import { buildPolicyArrays } from '../src/engine/policyData'
import type { PolicyFile } from '../src/engine/policyData'
import { DEFAULT_PARAMS } from '../src/engine/params'
import { createMosquitoes, EMAX } from '../src/engine/mosquitoes'
import { dayStart, dayAdultDeath, dayEggs } from '../src/engine/daily'
import type { CleaningPlan } from '../src/engine/daily'
import { runSpinup } from '../src/engine/spinup'
import { makeCleaningOffsets } from '../src/engine/schedule'
import { createFogState, applyFogging } from '../src/engine/fogging'
import { mosquitoInfection } from '../src/engine/infection'
import { createMovement, placePeople } from '../src/engine/movement'
import { createTimers, applyInitialImmune, seedInfection, infectPeople, updateHumans } from '../src/engine/humans'
import { importInfections } from '../src/engine/imports'
import { createRng } from '../src/engine/rng'

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf-8')) as T
}

const NAMES = [
  'cleaning + development',
  'fogging',
  'adult death',
  'movement',
  'mosquito infection',
  'people infection',
  'imports',
  'egg laying',
  'humans update',
  'recording',
]

describe.skipIf(!process.env.TIMING)('time spent in each step of the day', () => {
  it('runs the full record and prints the time per step', () => {
    const world = buildWorld(readJson<PopulationFile>('public/data/population.json'))
    const weather = buildWeather(readJson<WeatherFile>('public/data/weather.json'))
    const policyFile = readJson<PolicyFile>('public/data/policy.json')
    const policy = buildPolicyArrays(world, policyFile)
    const params = DEFAULT_PARAMS
    const compliance = new Float64Array(policy.intervals.length).fill(params.compliance)

    // same setup as run.ts
    const rng = createRng(1)
    const w: World = { ...world, personState: world.personState.slice() }
    const people = w.personState.length
    const households = w.householdSize.length
    const M = w.municipalities.length
    const days = weather.days
    const m = createMosquitoes(w, params.adultsPerPerson)
    const plan: CleaningPlan = {
      intervals: policy.intervals,
      offsets: makeCleaningOffsets(policy.intervals, rng),
      compliance,
      out: new Uint8Array(households),
    }

    const tSpin = performance.now()
    runSpinup(m, w.householdSize, plan, weather.t2m, weather.rain14, params, rng)
    const spinSeconds = (performance.now() - tSpin) / 1000

    applyInitialImmune(w, params.initialImmune, rng)
    const timer = createTimers(w)
    seedInfection(w, timer, params, rng)
    const mv = createMovement(w, policyFile.centroids, params.gravityBeta)
    const fog = createFogState(M)

    const loc = new Int32Array(people)
    const present = new Int32Array(households)
    const infectiousPresent = new Int32Array(households)
    const newE = new Uint8Array(people)
    const pInfect = new Float64Array(households)
    const dayOnsets = new Int32Array(M)
    const onsets = new Int32Array(days * M)
    const fogged = new Uint8Array(days * M)

    const spent = new Float64Array(NAMES.length)
    let t = 0
    const lap = (i: number) => {
      const now = performance.now()
      spent[i] += now - t
      t = now
    }
    let sink = 0 // keeps the recording loops from being skipped

    const tAll = performance.now()
    for (let day = 0; day < days; day++) {
      const tempC = weather.t2m[day]
      const rain14 = weather.rain14[day]
      t = performance.now()

      dayStart(m, plan, day, tempC, params, rng)
      lap(0)

      applyFogging(m, w.householdMunicipality, M, policy.foggingTrigger, onsets, day, day, fog, params, rng)
      for (let k = 0; k < M; k++) fogged[day * M + k] = fog.lastFog[k] === day ? 1 : 0
      lap(1)

      dayAdultDeath(m, tempC, rng)
      lap(2)

      placePeople(w, mv, params, rng, loc, present, infectiousPresent)
      lap(3)

      mosquitoInfection(m, infectiousPresent, present, tempC, params, rng)
      lap(4)

      infectPeople(w, loc, present, m.Im, params, rng, newE, pInfect)
      lap(5)

      importInfections(w, newE, day, params, rng)
      lap(6)

      dayEggs(m, w.householdSize, tempC, rain14, params, rng)
      lap(7)

      updateHumans(w, timer, newE, params, rng, dayOnsets)
      lap(8)

      onsets.set(dayOnsets, day * M)
      let adults = 0
      let infectiousAdults = 0
      for (let h = 0; h < households; h++) {
        adults += m.Sm[h] + m.Im[h]
        infectiousAdults += m.Im[h]
      }
      for (let i = 0; i < households * EMAX; i++) adults += m.em[i]
      let s = 0
      let e = 0
      let inf = 0
      let r = 0
      for (let p = 0; p < people; p++) {
        const state = w.personState[p]
        if (state === SUSCEPTIBLE) s++
        else if (state === EXPOSED) e++
        else if (state === INFECTIOUS) inf++
        else if (state === RECOVERED) r++
      }
      sink += adults + infectiousAdults + s + e + inf + r
      lap(9)
    }
    const total = (performance.now() - tAll) / 1000

    const lines = NAMES.map((name, i) => {
      const seconds = spent[i] / 1000
      return `${name.padEnd(26)} ${seconds.toFixed(1).padStart(5)} s  ${((seconds / total) * 100).toFixed(0).padStart(3)} %`
    })
    console.log(
      `Warm-up (150 days): ${spinSeconds.toFixed(1)} s\n` +
        `Record (${days} days): ${total.toFixed(1)} s\n` +
        lines.join('\n') +
        `\n(check value ${sink})`,
    )
  }, 600000)
})