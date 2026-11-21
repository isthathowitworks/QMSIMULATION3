import { describe, it, expect } from 'vitest'
import { createRng } from '../src/engine/rng'
import { buildWorld, EXPOSED, INFECTIOUS, RECOVERED } from '../src/engine/population'
import type { World } from '../src/engine/population'
import { DEFAULT_PARAMS } from '../src/engine/params'
import {
  createTimers,
  applyInitialImmune,
  seedInfection,
  infectPeople,
  updateHumans,
} from '../src/engine/humans'

// 30 people in 6 households of 5. Municipality A has households 0-3 (people 0-19),
// municipality B has households 4-5 (people 20-29).
function makeWorld(): World {
  return buildWorld({
    peoplePerSimPerson: 10,
    peoplePerHousehold: 5,
    barangays: [
      { municipality: 'A', barangay: 'a1', population: 200, simPeople: 20, households: 4 },
      { municipality: 'B', barangay: 'b1', population: 100, simPeople: 10, households: 2 },
    ],
  })
}

// 10,000 people in 100 households of 100, one municipality (for rate checks).
function makeBigWorld(): World {
  return buildWorld({
    peoplePerSimPerson: 10,
    peoplePerHousehold: 5,
    barangays: [{ municipality: 'A', barangay: 'a1', population: 100000, simPeople: 10000, households: 100 }],
  })
}

function countStates(w: World): number[] {
  const c = [0, 0, 0, 0]
  for (let p = 0; p < w.personState.length; p++) c[w.personState[p]]++
  return c
}

describe('infectPeople (4d)', () => {
  it('with no infectious mosquitoes, nobody is infected', () => {
    const w = makeWorld()
    const newE = new Uint8Array(30)
    const n = infectPeople(
      w, w.personHousehold, Int32Array.from(w.householdSize), new Int32Array(6),
      DEFAULT_PARAMS, createRng(1), newE, new Float64Array(6),
    )
    expect(n).toBe(0)
    expect(newE.every((v) => v === 0)).toBe(true)
  })

  it('only susceptible people can be infected', () => {
    const w = makeWorld()
    for (let p = 0; p < 10; p++) w.personState[p] = RECOVERED
    for (let p = 10; p < 20; p++) w.personState[p] = INFECTIOUS
    const newE = new Uint8Array(30)
    const n = infectPeople(
      w, w.personHousehold, Int32Array.from(w.householdSize), new Int32Array(6).fill(1000),
      DEFAULT_PARAMS, createRng(2), newE, new Float64Array(6),
    )
    expect(n).toBe(10)
    for (let p = 0; p < 20; p++) expect(newE[p]).toBe(0)
    for (let p = 20; p < 30; p++) expect(newE[p]).toBe(1)
  })

  it('infects at about the expected rate, using where people are today', () => {
    const w = makeBigWorld()
    const loc = new Int32Array(10000) // everyone is in household 0 today
    const present = new Int32Array(100)
    present[0] = 100
    const Im = new Int32Array(100)
    Im[0] = 100
    const newE = new Uint8Array(10000)
    const n = infectPeople(w, loc, present, Im, DEFAULT_PARAMS, createRng(3), newE, new Float64Array(100))
    // p = 1 - exp(-0.3 * 0.4 * 100 / 100) = about 0.113, so about 1131 of 10000
    expect(n).toBeGreaterThan(1000)
    expect(n).toBeLessThan(1260)
    let flagged = 0
    for (let p = 0; p < 10000; p++) flagged += newE[p]
    expect(flagged).toBe(n)
  })

  it('a household with nobody present gives no NaN', () => {
    const w = makeWorld()
    const newE = new Uint8Array(30)
    const n = infectPeople(
      w, w.personHousehold, new Int32Array(6), new Int32Array(6),
      DEFAULT_PARAMS, createRng(4), newE, new Float64Array(6),
    )
    expect(Number.isFinite(n)).toBe(true)
    expect(n).toBe(0)
  })
})

describe('updateHumans (step 5)', () => {
  it('exposed person at the end of incubation becomes infectious and counts as an onset', () => {
    const w = makeWorld()
    const timer = createTimers(w)
    w.personState[0] = EXPOSED // municipality A
    timer[0] = 1
    w.personState[20] = EXPOSED // municipality B
    timer[20] = 1
    const onsets = new Int32Array(2)
    updateHumans(w, timer, new Uint8Array(30), DEFAULT_PARAMS, createRng(5), onsets)
    expect(w.personState[0]).toBe(INFECTIOUS)
    expect(w.personState[20]).toBe(INFECTIOUS)
    expect(timer[0]).toBe(DEFAULT_PARAMS.infectiousDays)
    expect(Array.from(onsets)).toEqual([1, 1])
  })

  it('infectious person at the end of the infectious period recovers', () => {
    const w = makeWorld()
    const timer = createTimers(w)
    w.personState[3] = INFECTIOUS
    timer[3] = 1
    const onsets = new Int32Array(2)
    updateHumans(w, timer, new Uint8Array(30), { ...DEFAULT_PARAMS, popTurnoverPerYear: 0 }, createRng(6), onsets)
    expect(w.personState[3]).toBe(RECOVERED)
    expect(Array.from(onsets)).toEqual([0, 0])
  })

  it('a person with days left stays in the same state and the timer counts down', () => {
    const w = makeWorld()
    const timer = createTimers(w)
    w.personState[5] = EXPOSED
    timer[5] = 3
    w.personState[6] = INFECTIOUS
    timer[6] = 4
    updateHumans(w, timer, new Uint8Array(30), DEFAULT_PARAMS, createRng(7), new Int32Array(2))
    expect(w.personState[5]).toBe(EXPOSED)
    expect(timer[5]).toBe(2)
    expect(w.personState[6]).toBe(INFECTIOUS)
    expect(timer[6]).toBe(3)
  })

  it('newly infected people become exposed with a full incubation timer', () => {
    const w = makeWorld()
    const timer = createTimers(w)
    const newE = new Uint8Array(30)
    newE[8] = 1
    newE[9] = 1
    const n = updateHumans(w, timer, newE, DEFAULT_PARAMS, createRng(8), new Int32Array(2))
    expect(n).toBe(2)
    expect(w.personState[8]).toBe(EXPOSED)
    expect(timer[8]).toBe(DEFAULT_PARAMS.incubationDays)
    expect(w.personState[9]).toBe(EXPOSED)
  })

  it('with a turnover chance of 1, every recovered person becomes susceptible', () => {
    const w = makeWorld()
    for (let p = 0; p < 30; p++) w.personState[p] = RECOVERED
    updateHumans(w, createTimers(w), new Uint8Array(30), { ...DEFAULT_PARAMS, popTurnoverPerYear: 365 }, createRng(9), new Int32Array(2))
    expect(countStates(w)).toEqual([30, 0, 0, 0])
  })

  it('with turnover 0, recovered people stay recovered', () => {
    const w = makeWorld()
    for (let p = 0; p < 30; p++) w.personState[p] = RECOVERED
    updateHumans(w, createTimers(w), new Uint8Array(30), { ...DEFAULT_PARAMS, popTurnoverPerYear: 0 }, createRng(10), new Int32Array(2))
    expect(countStates(w)).toEqual([0, 0, 0, 30])
  })

  it('resets the onsets array every call', () => {
    const w = makeWorld()
    const onsets = new Int32Array([99, 99])
    updateHumans(w, createTimers(w), new Uint8Array(30), DEFAULT_PARAMS, createRng(11), onsets)
    expect(Array.from(onsets)).toEqual([0, 0])
  })
})

describe('seeding', () => {
  it('seeds exactly seedInfected infectious people with a timer from 1 to infectiousDays', () => {
    const w = makeWorld()
    const timer = createTimers(w)
    const k = seedInfection(w, timer, DEFAULT_PARAMS, createRng(12))
    expect(k).toBe(3)
    expect(countStates(w)).toEqual([27, 0, 3, 0])
    for (let p = 0; p < 30; p++) {
      if (w.personState[p] === INFECTIOUS) {
        expect(timer[p]).toBeGreaterThanOrEqual(1)
        expect(timer[p]).toBeLessThanOrEqual(DEFAULT_PARAMS.infectiousDays)
      }
    }
  })

  it('same seed seeds the same people', () => {
    const a = makeWorld()
    const b = makeWorld()
    seedInfection(a, createTimers(a), DEFAULT_PARAMS, createRng(13))
    seedInfection(b, createTimers(b), DEFAULT_PARAMS, createRng(13))
    expect(Array.from(a.personState)).toEqual(Array.from(b.personState))
  })

  it('never seeds more people than exist', () => {
    const w = makeWorld()
    const k = seedInfection(w, createTimers(w), { ...DEFAULT_PARAMS, seedInfected: 500 }, createRng(14))
    expect(k).toBe(30)
    expect(countStates(w)).toEqual([0, 0, 30, 0])
  })

  it('initialImmune 1 makes everyone recovered, 0 changes nobody', () => {
    const a = makeWorld()
    applyInitialImmune(a, 1, createRng(15))
    expect(countStates(a)).toEqual([0, 0, 0, 30])
    const b = makeWorld()
    applyInitialImmune(b, 0, createRng(15))
    expect(countStates(b)).toEqual([30, 0, 0, 0])
  })
})

describe('a few weeks of infection on the small world', () => {
  it('keeps everyone in one of the four states and timers valid', () => {
    const w = makeWorld()
    const rng = createRng(16)
    const timer = createTimers(w)
    seedInfection(w, timer, DEFAULT_PARAMS, rng)
    const newE = new Uint8Array(30)
    const pInfect = new Float64Array(6)
    const Im = new Int32Array(6).fill(5)
    const present = Int32Array.from(w.householdSize)
    const onsets = new Int32Array(2)
    for (let day = 0; day < 200; day++) {
      infectPeople(w, w.personHousehold, present, Im, DEFAULT_PARAMS, rng, newE, pInfect)
      updateHumans(w, timer, newE, DEFAULT_PARAMS, rng, onsets)
      const c = countStates(w)
      expect(c[0] + c[1] + c[2] + c[3]).toBe(30)
      for (let p = 0; p < 30; p++) {
        if (w.personState[p] === EXPOSED || w.personState[p] === INFECTIOUS) {
          expect(timer[p]).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })
})