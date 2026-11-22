import { describe, it, expect } from 'vitest'
import type { World } from '../src/engine/population'
import type { PolicyArrays } from '../src/engine/policyData'
import type { Centroids } from '../src/engine/movement'
import { DEFAULT_PARAMS } from '../src/engine/params'
import type { Params } from '../src/engine/params'
import { buildWeather } from '../src/engine/weather'
import { runSimulation } from '../src/engine/run'

// M3 step 3.2: policy checks on a small stand-in world (two municipalities, 80 households,
// 320 people), warm and wet weather all the time. Every policy is run with the same seeds and
// compared by the average number of people infected by mosquito bites (imports are left out,
// because no policy can change them). A check fails only when a "better" policy comes out worse
// than a "worse" one by more than TOLERANCE people on average.

const HOUSEHOLDS = 80
const SIZE = 4
const PEOPLE = HOUSEHOLDS * SIZE
const DAYS = 200
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)
const TOLERANCE = 5 // people (about 1.5% of the 320)
const NEVER = 1_000_000 // a fogging trigger nobody ever reaches

function makeWorld(): World {
  const householdMunicipality = new Int32Array(HOUSEHOLDS)
  const householdSize = new Uint8Array(HOUSEHOLDS).fill(SIZE)
  const householdFirstPerson = new Int32Array(HOUSEHOLDS)
  const householdBarangay = new Int32Array(HOUSEHOLDS)
  for (let h = 0; h < HOUSEHOLDS; h++) {
    householdMunicipality[h] = h < HOUSEHOLDS / 2 ? 0 : 1
    householdFirstPerson[h] = h * SIZE
  }
  const personHousehold = new Int32Array(PEOPLE)
  for (let p = 0; p < PEOPLE; p++) personHousehold[p] = Math.floor(p / SIZE)
  return {
    municipalities: ['A', 'B'],
    barangays: ['a1', 'b1'],
    householdMunicipality,
    householdBarangay,
    householdFirstPerson,
    householdSize,
    personHousehold,
    personState: new Uint8Array(PEOPLE),
  } as unknown as World
}

const weather = buildWeather({
  start: '2019-01-01',
  days: DAYS,
  t2m: new Array<number>(DAYS).fill(28),
  rain: new Array<number>(DAYS).fill(10),
})

const centroids: Centroids = {
  A: { lon: 123.0, lat: 14.0 },
  B: { lon: 123.2, lat: 14.1 },
}

interface Policy {
  interval: number // days between cleanings; 0 = no cleaning
  compliance: number
  trigger: number // reported cases in 7 days that start fogging
}

// People infected by mosquito bites in one run (new infections minus imports).
function bitten(policy: Policy, seed: number): number {
  const arrays: PolicyArrays = {
    intervals: new Int32Array(HOUSEHOLDS).fill(policy.interval),
    foggingTrigger: Int32Array.from([policy.trigger, policy.trigger]),
  }
  const params: Params = {
    ...DEFAULT_PARAMS,
    spinupDays: 60,
    seedInfected: 3,
    importPerDayPer100k: 20,
    importSurgeOn: false,
    compliance: policy.compliance,
  }
  const compliance = new Float64Array(HOUSEHOLDS).fill(policy.compliance)
  const r = runSimulation(makeWorld(), weather, arrays, centroids, compliance, params, seed)
  let total = 0
  for (let d = 0; d < DAYS; d++) total += r.newInfections[d] - r.imported[d]
  return total
}

// Average over the shared seeds. Each policy is run once and remembered, because
// several checks compare against the same policy.
const remembered = new Map<string, number>()
function mean(policy: Policy): number {
  const key = `${policy.interval}/${policy.compliance}/${policy.trigger}`
  const known = remembered.get(key)
  if (known !== undefined) return known
  let sum = 0
  for (const seed of SEEDS) sum += bitten(policy, seed)
  const result = sum / SEEDS.length
  remembered.set(key, result)
  return result
}

// "better" must not come out worse than "worse" by more than the tolerance.
function expectNoWorse(better: Policy, worse: Policy): void {
  expect(mean(better)).toBeLessThanOrEqual(mean(worse) + TOLERANCE)
}

const NO_CLEANING: Policy = { interval: 0, compliance: 0.5, trigger: NEVER }

// Each check runs about 20 simulations per policy, so allow up to 2 minutes per test.
describe('policy checks (averaged runs, shared seeds)', { timeout: 120_000 }, () => {
  it('there are enough infections for the comparisons to mean something', () => {
    expect(mean(NO_CLEANING)).toBeGreaterThan(100)
  })

  it('no cleaning gives the most infections of any cleaning policy', () => {
    const worst = mean(NO_CLEANING)
    for (const interval of [14, 7]) {
      for (const compliance of [0.2, 0.5, 0.9]) {
        const m = mean({ interval, compliance, trigger: NEVER })
        expect(m).toBeLessThanOrEqual(worst + TOLERANCE)
      }
    }
  })

  it('higher compliance never raises infections', () => {
    const low: Policy = { interval: 7, compliance: 0.2, trigger: NEVER }
    const mid: Policy = { interval: 7, compliance: 0.5, trigger: NEVER }
    const high: Policy = { interval: 7, compliance: 0.9, trigger: NEVER }
    expectNoWorse(mid, low)
    expectNoWorse(high, mid)
  })

  it('cleaning more often never raises infections', () => {
    const every14: Policy = { interval: 14, compliance: 0.5, trigger: NEVER }
    const every7: Policy = { interval: 7, compliance: 0.5, trigger: NEVER }
    expectNoWorse(every14, NO_CLEANING)
    expectNoWorse(every7, every14)
  })

  it('fogging more easily (a lower trigger) never raises infections', () => {
    const at20: Policy = { interval: 0, compliance: 0.5, trigger: 20 }
    const at5: Policy = { interval: 0, compliance: 0.5, trigger: 5 }
    const at1: Policy = { interval: 0, compliance: 0.5, trigger: 1 }
    expectNoWorse(at20, NO_CLEANING)
    expectNoWorse(at5, at20)
    expectNoWorse(at1, at5)
  })
})