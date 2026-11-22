import { describe, it, expect } from 'vitest'
import type { World } from '../src/engine/population'
import type { RunResult } from '../src/engine/run'
import { DEFAULT_PARAMS } from '../src/engine/params'
import type { Params } from '../src/engine/params'
import { buildWeather } from '../src/engine/weather'
import { runJob } from '../src/engine/runJob'
import type { EngineData } from '../src/engine/runJob'

// M3 step 3.3: 0% compliance with fogging off gives the same result as the no-cleaning preset
// (cleaningIntervalDays 0). Both are run through runJob, the same way the app will run them.
// The two are not identical run for run: with 0% compliance the engine still rolls a random
// number for every household that is due to clean, so the random numbers shift. What must hold
// is that nothing is ever cleaned or fogged in either, and that the averages over shared seeds
// agree within a small tolerance (the same one as in policyChecks.test.ts).

const HOUSEHOLDS = 80
const SIZE = 4
const PEOPLE = HOUSEHOLDS * SIZE
const DAYS = 200
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)
const TOLERANCE = 5 // people (about 1.5% of the 320)

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

// policy.json stand-in: every municipality cleans every 7 days and fogs from 1 case.
const data: EngineData = {
  world: makeWorld(),
  weather: buildWeather({
    start: '2019-01-01',
    days: DAYS,
    t2m: new Array<number>(DAYS).fill(28),
    rain: new Array<number>(DAYS).fill(10),
  }),
  policyFile: {
    municipalities: [
      { municipality: 'A', wasteCollectionIntervalDays: 7, foggingTriggerCases: 1 },
      { municipality: 'B', wasteCollectionIntervalDays: 7, foggingTriggerCases: 1 },
    ],
    centroids: { A: { lon: 123.0, lat: 14.0 }, B: { lon: 123.2, lat: 14.1 } },
  },
}

// One run through runJob. `cleaningIntervalDays` left out means the policy file's 7 days.
function run(
  compliance: number,
  seed: number,
  foggingOn: boolean,
  cleaningIntervalDays?: number,
): RunResult {
  const params: Params = {
    ...DEFAULT_PARAMS,
    spinupDays: 60,
    seedInfected: 3,
    importPerDayPer100k: 20,
    importSurgeOn: false,
    compliance,
  }
  let result: RunResult | null = null
  let problem: string | null = null
  runJob(
    data,
    { type: 'run', id: 1, params, seed, foggingOn, cleaningIntervalDays },
    (reply) => {
      if (reply.type === 'done') result = reply.result
      if (reply.type === 'error') problem = reply.message
    },
  )
  if (!result) throw new Error(problem ?? 'no result')
  return result
}

function total(a: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i]
  return sum
}

// People infected by mosquito bites (new infections minus imports).
function bitten(r: RunResult): number {
  return total(r.newInfections) - total(r.imported)
}

function meanOver(make: (seed: number) => RunResult): { bitten: number; adults: number } {
  let b = 0
  let a = 0
  for (const seed of SEEDS) {
    const r = make(seed)
    b += bitten(r)
    a += total(r.adults)
  }
  return { bitten: b / SEEDS.length, adults: a / SEEDS.length }
}

// Each check runs about 20 simulations per policy, so allow up to 2 minutes per test.
describe('0% compliance with fogging off equals the no-cleaning preset', { timeout: 120_000 }, () => {
  it('nothing is cleaned or fogged in either, in any run', () => {
    for (const seed of [1, 2, 3]) {
      const zeroCompliance = run(0, seed, false)
      const noCleaning = run(0.5, seed, false, 0)
      expect(total(zeroCompliance.cleanings)).toBe(0)
      expect(total(noCleaning.cleanings)).toBe(0)
      expect(total(zeroCompliance.foggingRounds)).toBe(0)
      expect(total(noCleaning.foggingRounds)).toBe(0)
    }
  })

  it('the averages agree: infections within the tolerance, adult mosquitoes within 1%', () => {
    const zeroCompliance = meanOver((seed) => run(0, seed, false))
    const noCleaning = meanOver((seed) => run(0.5, seed, false, 0))
    expect(Math.abs(zeroCompliance.bitten - noCleaning.bitten)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(zeroCompliance.adults - noCleaning.adults)).toBeLessThanOrEqual(
      0.01 * noCleaning.adults,
    )
  })

  it('the comparison can tell a difference: real cleaning gives clearly fewer infections', () => {
    const noCleaning = meanOver((seed) => run(0.5, seed, false, 0))
    const cleaning = meanOver((seed) => run(0.5, seed, false))
    expect(noCleaning.bitten).toBeGreaterThan(100)
    expect(cleaning.bitten).toBeLessThan(noCleaning.bitten - 4 * TOLERANCE)
  })
})