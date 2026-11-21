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
const DAYS = 60

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

// Cold all the time: no eggs are laid, so the adult count can only go down.
const coldWeather: Weather = {
  start: '2019-01-01',
  days: DAYS,
  t2m: new Float64Array(DAYS).fill(15),
  rain: new Float64Array(DAYS).fill(7),
  rain14: new Float64Array(DAYS).fill(100),
}

const policy: PolicyArrays = {
  intervals: new Int32Array(HOUSEHOLDS).fill(7),
  foggingTrigger: Int32Array.from([1000, 1000]),
}

const centroids: Centroids = {
  A: { lon: 123.0, lat: 14.0 },
  B: { lon: 123.2, lat: 14.1 },
}

function go(overrides: Partial<Params> = {}) {
  const params: Params = { ...DEFAULT_PARAMS, spinupDays: 20, seedInfected: 10, ...overrides }
  const compliance = new Float64Array(HOUSEHOLDS).fill(0)
  return runSimulation(makeWorld(), coldWeather, policy, centroids, compliance, params, 4)
}

describe('runSimulation recording of adult mosquitoes', () => {
  it('in cold weather the adult count never goes up from one day to the next', () => {
    const r = go()
    for (let d = 1; d < DAYS; d++) {
      expect(r.adults[d]).toBeLessThanOrEqual(r.adults[d - 1])
    }
  })

  it('on day 0 there are no more adults than the starting number (6 per household)', () => {
    const r = go()
    expect(r.adults[0]).toBeLessThanOrEqual(HOUSEHOLDS * 6)
  })

  it('infectious adults are never more than all adults', () => {
    const r = go({ pH2m: 1, biteRate: 1 })
    for (let d = 0; d < DAYS; d++) {
      expect(r.infectiousAdults[d]).toBeLessThanOrEqual(r.adults[d])
      expect(r.infectiousAdults[d]).toBeGreaterThanOrEqual(0)
    }
  })

  it('the four states still add up to everybody on every day', () => {
    const r = go()
    for (let d = 0; d < DAYS; d++) {
      expect(r.susceptible[d] + r.exposed[d] + r.infectious[d] + r.recovered[d]).toBe(PEOPLE)
    }
  })
})