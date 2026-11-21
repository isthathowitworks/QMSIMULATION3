import { describe, it, expect } from 'vitest'
import { createRng } from '../src/engine/rng'
import { buildWorld, RECOVERED } from '../src/engine/population'
import type { World } from '../src/engine/population'
import { DEFAULT_PARAMS } from '../src/engine/params'
import { importRatePer100k, importInfections } from '../src/engine/imports'

// 30 people in 6 households.
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

// 10,000 people in 100 households, one municipality.
function makeBigWorld(): World {
  return buildWorld({
    peoplePerSimPerson: 10,
    peoplePerHousehold: 5,
    barangays: [{ municipality: 'A', barangay: 'a1', population: 100000, simPeople: 10000, households: 100 }],
  })
}

const params = { ...DEFAULT_PARAMS, importPerDayPer100k: 0.05, importedSurgeSize: 20, importSurgeOn: true }

describe('importRatePer100k', () => {
  it('is the background rate outside the surge weeks', () => {
    expect(importRatePer100k(0, params)).toBe(0.05) // week 1
    expect(importRatePer100k(29 * 7 - 1, params)).toBe(0.05) // last day of week 29
    expect(importRatePer100k(44 * 7, params)).toBe(0.05) // first day of week 45
  })

  it('adds the surge in weeks 30 to 44 of 2019', () => {
    expect(importRatePer100k(29 * 7, params)).toBe(20.05) // first day of week 30
    expect(importRatePer100k(44 * 7 - 1, params)).toBe(20.05) // last day of week 44
  })

  it('has no surge in later years, even in weeks 30 to 44', () => {
    expect(importRatePer100k(364 + 29 * 7, params)).toBe(0.05) // 2020, week 30
    expect(importRatePer100k(2 * 364 + 35 * 7, params)).toBe(0.05)
  })

  it('has no surge when it is switched off', () => {
    expect(importRatePer100k(29 * 7, { ...params, importSurgeOn: false })).toBe(0.05)
  })

  it('gives the background rate on warm-up days (negative)', () => {
    expect(importRatePer100k(-5, params)).toBe(0.05)
  })
})

describe('importInfections', () => {
  it('does nothing when the rate is 0', () => {
    const w = makeWorld()
    const newE = new Uint8Array(30)
    const n = importInfections(w, newE, 0, { ...params, importPerDayPer100k: 0, importSurgeOn: false }, createRng(1))
    expect(n).toBe(0)
    expect(newE.every((v) => v === 0)).toBe(true)
  })

  it('marks only susceptible people, and never more than exist', () => {
    const w = makeWorld()
    for (let p = 0; p < 10; p++) w.personState[p] = RECOVERED
    const newE = new Uint8Array(30)
    const huge = { ...params, importPerDayPer100k: 1e6, importSurgeOn: false }
    const n = importInfections(w, newE, 0, huge, createRng(2))
    expect(n).toBe(20)
    for (let p = 0; p < 10; p++) expect(newE[p]).toBe(0)
    for (let p = 10; p < 30; p++) expect(newE[p]).toBe(1)
  })

  it('skips people already infected today and does not count them', () => {
    const w = makeWorld()
    const newE = new Uint8Array(30)
    for (let p = 0; p < 10; p++) newE[p] = 1
    const huge = { ...params, importPerDayPer100k: 1e6, importSurgeOn: false }
    const n = importInfections(w, newE, 0, huge, createRng(3))
    expect(n).toBe(20)
    expect(newE.every((v) => v === 1)).toBe(true)
  })

  it('averages about the expected number per day', () => {
    const w = makeBigWorld() // lambda = rate x 10000 x 10 / 1e5 = rate
    const p50 = { ...params, importPerDayPer100k: 50, importSurgeOn: false }
    const rng = createRng(4)
    let total = 0
    const days = 200
    for (let d = 0; d < days; d++) {
      total += importInfections(w, new Uint8Array(10000), 400, p50, rng)
    }
    const mean = total / days
    expect(mean).toBeGreaterThan(47)
    expect(mean).toBeLessThan(53)
  })

  it('imports more during the 2019 surge than outside it', () => {
    const w = makeBigWorld()
    const rng = createRng(5)
    let inSurge = 0
    let outside = 0
    for (let d = 0; d < 50; d++) {
      inSurge += importInfections(w, new Uint8Array(10000), 29 * 7, params, rng)
      outside += importInfections(w, new Uint8Array(10000), 10, params, rng)
    }
    expect(inSurge).toBeGreaterThan(outside * 10)
  })

  it('same seed gives the same people', () => {
    const run = (seed: number) => {
      const w = makeWorld()
      const newE = new Uint8Array(30)
      importInfections(w, newE, 0, { ...params, importPerDayPer100k: 40000, importSurgeOn: false }, createRng(seed))
      return Array.from(newE)
    }
    expect(run(6)).toEqual(run(6))
  })
})