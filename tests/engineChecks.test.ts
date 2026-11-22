import { describe, it, expect } from 'vitest'
import type { World } from '../src/engine/population'
import type { PolicyArrays } from '../src/engine/policyData'
import type { Centroids } from '../src/engine/movement'
import type { RunResult } from '../src/engine/run'
import { DEFAULT_PARAMS } from '../src/engine/params'
import type { Params } from '../src/engine/params'
import { buildWeather } from '../src/engine/weather'
import { runSimulation } from '../src/engine/run'

const HOUSEHOLDS = 40
const SIZE = 4
const PEOPLE = HOUSEHOLDS * SIZE
const DAYS = 200

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

// No cleaning at all, so only the weather can change the mosquito numbers.
const policy: PolicyArrays = {
  intervals: new Int32Array(HOUSEHOLDS).fill(0),
  foggingTrigger: Int32Array.from([1, 1]),
}

const centroids: Centroids = {
  A: { lon: 123.0, lat: 14.0 },
  B: { lon: 123.2, lat: 14.1 },
}

const compliance = new Float64Array(HOUSEHOLDS).fill(0.5)

// Weather from a function: day number -> [temperature in C, rain in mm].
function makeWeather(dayWeather: (day: number) => [number, number]) {
  const t2m: number[] = []
  const rain: number[] = []
  for (let d = 0; d < DAYS; d++) {
    const [t, r] = dayWeather(d)
    t2m.push(t)
    rain.push(r)
  }
  return buildWeather({ start: '2019-01-01', days: DAYS, t2m, rain })
}

const WARM_WET: [number, number] = [28, 10] // 140 mm over 14 days
const COOL_DRY: [number, number] = [20, 0]

function go(
  weather: ReturnType<typeof makeWeather>,
  overrides: Partial<Params> = {},
  seed = 1,
): RunResult {
  const params: Params = { ...DEFAULT_PARAMS, spinupDays: 20, ...overrides }
  return runSimulation(makeWorld(), weather, policy, centroids, compliance, params, seed)
}

// No seeds, no imports: the mosquitoes live their lives and nothing else happens.
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

// Average adult mosquitoes over days from..to-1.
function meanAdults(r: RunResult, from: number, to: number): number {
  let sum = 0
  for (let d = from; d < to; d++) sum += r.adults[d]
  return sum / (to - from)
}

const START_ADULTS = Math.round(PEOPLE * DEFAULT_PARAMS.adultsPerPerson) // 240

describe('seasons show in the mosquito numbers', () => {
  it('warm and wet weather gives many more adults than cool and dry weather', () => {
    const warm = go(makeWeather(() => WARM_WET), NO_DISEASE)
    const cool = go(makeWeather(() => COOL_DRY), NO_DISEASE)
    const warmMean = meanAdults(warm, DAYS - 20, DAYS)
    const coolMean = meanAdults(cool, DAYS - 20, DAYS)
    expect(warmMean).toBeGreaterThan(START_ADULTS)
    expect(coolMean).toBeLessThan(START_ADULTS)
    expect(warmMean).toBeGreaterThan(2 * coolMean)
  })

  it('when the weather turns from warm and wet to cool and dry, the adults fall', () => {
    const r = go(makeWeather((d) => (d < 100 ? WARM_WET : COOL_DRY)), NO_DISEASE)
    const endOfWarm = meanAdults(r, 80, 100)
    const endOfCool = meanAdults(r, 180, 200)
    expect(endOfWarm).toBeGreaterThan(2 * endOfCool)
  })
})

describe('seeds', () => {
  it('a different seed gives a different run', () => {
    const weather = makeWeather(() => WARM_WET)
    const a = go(weather, LOTS_OF_IMPORTS, 1)
    const b = go(weather, LOTS_OF_IMPORTS, 2)
    expect(Array.from(b.newInfections)).not.toEqual(Array.from(a.newInfections))
  })
})