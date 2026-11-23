import { describe, it, expect } from 'vitest'
import type { World } from '../src/engine/population'
import type { Weather } from '../src/engine/weather'
import type { PolicyArrays } from '../src/engine/policyData'
import type { Centroids } from '../src/engine/movement'
import { DEFAULT_PARAMS } from '../src/engine/params'
import type { Params } from '../src/engine/params'
import { runSimulation } from '../src/engine/run'

const HOUSEHOLDS = 40
const SIZE = 4
const PEOPLE = HOUSEHOLDS * SIZE
const DAYS = 120
const M = 2

// A small stand-in world: two municipalities with 20 households each.
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

const weather: Weather = {
  start: '2019-01-01',
  days: DAYS,
  t2m: new Float64Array(DAYS).fill(28),
  rain: new Float64Array(DAYS).fill(7),
  rain14: new Float64Array(DAYS).fill(100),
}

const policy: PolicyArrays = {
  intervals: new Int32Array(HOUSEHOLDS).fill(7),
  foggingTrigger: Int32Array.from([1, 1]),
}

const centroids: Centroids = {
  A: { lon: 123.0, lat: 14.0 },
  B: { lon: 123.2, lat: 14.1 },
}

const compliance = new Float64Array(HOUSEHOLDS).fill(0.5)

function go(overrides: Partial<Params> = {}, seed = 1, world = makeWorld()) {
  const params: Params = { ...DEFAULT_PARAMS, spinupDays: 20, ...overrides }
  return runSimulation(world, weather, policy, centroids, compliance, params, seed)
}

// No seeds, no imports: nothing can ever get infected.
const NO_DISEASE: Partial<Params> = {
  seedInfected: 0,
  importPerDayPer100k: 0,
  importSurgeOn: false,
}

// About 3 imported infections per day.
const LOTS_OF_IMPORTS: Partial<Params> = {
  seedInfected: 0,
  importPerDayPer100k: 200,
  importSurgeOn: false,
}

describe('runSimulation', () => {
  it('gives arrays of the right length', () => {
    const r = go()
    expect(r.days).toBe(DAYS)
    expect(r.municipalityCount).toBe(M)
    for (const a of [r.adults, r.immatures, r.infectiousAdults, r.cleanings, r.newInfections, r.imported,
      r.susceptible, r.exposed, r.infectious, r.recovered]) {
      expect(a.length).toBe(DAYS)
    }
    expect(r.onsets.length).toBe(DAYS * M)
    expect(r.biteInfections.length).toBe(DAYS * M)
    expect(r.fogged.length).toBe(DAYS * M)
    expect(r.foggingRounds.length).toBe(M)
  })

  it('the four states add up to everybody, every day', () => {
    const r = go(LOTS_OF_IMPORTS)
    for (let d = 0; d < DAYS; d++) {
      expect(r.susceptible[d] + r.exposed[d] + r.infectious[d] + r.recovered[d]).toBe(PEOPLE)
    }
  })

  it('gives the same result for the same seed', () => {
    const a = go(LOTS_OF_IMPORTS, 5)
    const b = go(LOTS_OF_IMPORTS, 5)
    expect(Array.from(b.adults)).toEqual(Array.from(a.adults))
    expect(Array.from(b.immatures)).toEqual(Array.from(a.immatures))
    expect(Array.from(b.newInfections)).toEqual(Array.from(a.newInfections))
    expect(Array.from(b.onsets)).toEqual(Array.from(a.onsets))
    expect(Array.from(b.fogged)).toEqual(Array.from(a.fogged))
  })

  it('does not change the world that was passed in', () => {
    const world = makeWorld()
    go(LOTS_OF_IMPORTS, 3, world)
    for (const s of world.personState) expect(s).toBe(0)
  })

  it('with no seeds and no imports, nobody is ever infected', () => {
    const r = go(NO_DISEASE)
    for (let d = 0; d < DAYS; d++) {
      expect(r.newInfections[d]).toBe(0)
      expect(r.exposed[d]).toBe(0)
      expect(r.infectious[d]).toBe(0)
      expect(r.susceptible[d]).toBe(PEOPLE)
    }
    for (const v of r.onsets) expect(v).toBe(0)
    for (const v of r.biteInfections) expect(v).toBe(0)
    for (const v of r.infectiousAdults) expect(v).toBe(0)
  })

  it('imports start infections, and imports never exceed new infections', () => {
    const r = go(LOTS_OF_IMPORTS)
    let imported = 0
    let onsets = 0
    for (let d = 0; d < DAYS; d++) {
      imported += r.imported[d]
      expect(r.imported[d]).toBeLessThanOrEqual(r.newInfections[d])
    }
    for (const v of r.onsets) onsets += v
    expect(imported).toBeGreaterThan(0)
    expect(onsets).toBeGreaterThan(0)
  })

  it('bite infections per municipality add up to new infections minus imports, every day', () => {
    const r = go(LOTS_OF_IMPORTS)
    let bites = 0
    for (let d = 0; d < DAYS; d++) {
      let sum = 0
      for (let k = 0; k < M; k++) sum += r.biteInfections[d * M + k]
      expect(sum).toBe(r.newInfections[d] - r.imported[d])
      bites += sum
    }
    expect(bites).toBeGreaterThan(0)
  })

  it('records only whole, non-negative numbers', () => {
    const r = go(LOTS_OF_IMPORTS)
    for (const a of [r.adults, r.immatures, r.infectiousAdults, r.cleanings, r.newInfections, r.imported,
      r.onsets, r.biteInfections, r.foggingRounds]) {
      for (const v of a) {
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('records the immature mosquitoes: some exist, and the count is there for every day', () => {
    const r = go(NO_DISEASE)
    expect(r.immatures.length).toBe(DAYS)
    let total = 0
    for (const v of r.immatures) total += v
    expect(total).toBeGreaterThan(0)
    expect(r.immatures[DAYS - 1]).toBeGreaterThan(0)
  })

  it('with fogging coverage 0, no fogging ever happens', () => {
    const r = go({ ...LOTS_OF_IMPORTS, fogCoverage: 0 })
    for (const v of r.fogged) expect(v).toBe(0)
    for (const v of r.foggingRounds) expect(v).toBe(0)
  })

  it('with cases and full coverage, fogging happens, and the daily flags add up to the rounds', () => {
    const r = go({ ...LOTS_OF_IMPORTS, fogCoverage: 1 })
    let total = 0
    for (let k = 0; k < M; k++) {
      let flags = 0
      for (let d = 0; d < DAYS; d++) flags += r.fogged[d * M + k]
      expect(flags).toBe(r.foggingRounds[k])
      total += r.foggingRounds[k]
    }
    expect(total).toBeGreaterThan(0)
  })

  it('calls the progress function, ending with the last day', () => {
    const calls: [number, number][] = []
    const params: Params = { ...DEFAULT_PARAMS, spinupDays: 20 }
    runSimulation(makeWorld(), weather, policy, centroids, compliance, params, 1,
      (done, total) => calls.push([done, total]))
    expect(calls.length).toBeGreaterThan(1)
    expect(calls[calls.length - 1]).toEqual([DAYS, DAYS])
  })
})