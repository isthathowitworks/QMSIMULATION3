import { describe, it, expect } from 'vitest'
import type { World } from '../src/engine/population'
import type { PolicyArrays } from '../src/engine/policyData'
import type { Centroids } from '../src/engine/movement'
import { DEFAULT_PARAMS } from '../src/engine/params'
import type { Params } from '../src/engine/params'
import { buildWeather } from '../src/engine/weather'
import { runSimulation } from '../src/engine/run'

// M3 step 3.5: run-to-run spread. The same policy is run with 20 different seeds on the same
// small stand-in world as policyChecks.test.ts (two municipalities, 80 households, 320 people,
// 200 days, warm and wet). The totals of people infected by mosquito bites should be similar
// from run to run: the standard deviation is a small share of the average, and no single run
// is wildly far from the average.

const HOUSEHOLDS = 80
const SIZE = 4
const PEOPLE = HOUSEHOLDS * SIZE
const DAYS = 200
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)
const NEVER = 1_000_000 // a fogging trigger nobody ever reaches

// Limits set from the first run (worst seen: SD 2.8% of the mean, furthest run 6.1% away),
// at about twice the worst value.
const MAX_SD_SHARE = 0.06 // standard deviation as a share of the average
const MAX_RUN_DISTANCE = 0.15 // every run within this share of the average

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
  name: string
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

interface Spread {
  totals: number[]
  mean: number
  sd: number
  min: number
  max: number
}

function spreadOf(policy: Policy): Spread {
  const totals = SEEDS.map((seed) => bitten(policy, seed))
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length
  const variance = totals.reduce((a, b) => a + (b - mean) ** 2, 0) / (totals.length - 1)
  return {
    totals,
    mean,
    sd: Math.sqrt(variance),
    min: Math.min(...totals),
    max: Math.max(...totals),
  }
}

const POLICIES: Policy[] = [
  { name: 'no cleaning', interval: 0, compliance: 0.5, trigger: NEVER },
  { name: 'weekly, 50% compliance', interval: 7, compliance: 0.5, trigger: NEVER },
]

// Each policy is 20 simulations, so allow up to 2 minutes per test.
describe('run-to-run spread (same policy, 20 seeds)', { timeout: 120_000 }, () => {
  for (const policy of POLICIES) {
    describe(policy.name, () => {
      const s = spreadOf(policy)
      console.log(
        `${policy.name}: mean ${s.mean.toFixed(1)}, sd ${s.sd.toFixed(1)} ` +
          `(${((100 * s.sd) / s.mean).toFixed(1)}% of mean), min ${s.min}, max ${s.max}`,
      )

      it('there are enough infections for the spread to mean something', () => {
        expect(s.mean).toBeGreaterThan(100)
      })

      it('the runs are not all identical (different seeds give different runs)', () => {
        expect(s.sd).toBeGreaterThan(0)
      })

      it('the standard deviation is a small share of the average', () => {
        expect(s.sd / s.mean).toBeLessThan(MAX_SD_SHARE)
      })

      it('no single run is far from the average', () => {
        expect(s.min).toBeGreaterThan(s.mean * (1 - MAX_RUN_DISTANCE))
        expect(s.max).toBeLessThan(s.mean * (1 + MAX_RUN_DISTANCE))
      })
    })
  }
})