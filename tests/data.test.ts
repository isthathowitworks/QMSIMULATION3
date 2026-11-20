// Checks the files that `npm run prepare-data` wrote into public/data.
// Run prepare-data first, then: npm test
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DATA = join(process.cwd(), 'public', 'data')
const read = (name: string) => JSON.parse(readFileSync(join(DATA, name), 'utf8'))

describe('public/data files', () => {
  it('all five files exist', () => {
    for (const f of ['weather.json', 'population.json', 'policy.json', 'camarines_norte_map.json', 'settings.json']) {
      expect(existsSync(join(DATA, f)), f).toBe(true)
    }
  })

  it('no case records are published', () => {
    expect(existsSync(join(DATA, 'cases'))).toBe(false)
  })
})

describe('weather.json', () => {
  const w = read('weather.json')

  it('has 2,557 days starting 2019-01-01', () => {
    expect(w.days).toBe(2557)
    expect(w.start).toBe('2019-01-01')
  })

  it('has one value per day in every series', () => {
    for (const k of ['t2m', 'rain', 'rh']) expect(w[k].length, k).toBe(2557)
  })

  it('has no missing or -999 values', () => {
    for (const k of ['t2m', 'rain', 'rh']) {
      for (const v of w[k]) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).not.toBe(-999)
      }
    }
  })
})

describe('population.json', () => {
  const p = read('population.json')

  it('has 39 barangays', () => {
    expect(p.barangays.length).toBe(39)
  })

  it('simulates 18,986 people in 3,797 households', () => {
    const sim = p.barangays.reduce((s: number, b: { simPeople: number }) => s + b.simPeople, 0)
    const hh = p.barangays.reduce((s: number, b: { households: number }) => s + b.households, 0)
    expect(sim).toBe(18986)
    expect(hh).toBe(3797)
  })
})

describe('policy.json', () => {
  it('covers 12 municipalities', () => {
    expect(Object.keys(read('policy.json').municipalities).length).toBe(12)
  })
})

describe('settings.json', () => {
  it('has the four fitted settings as numbers', () => {
    const s = read('settings.json')
    for (const k of ['bitingRate', 'carryingCapacityPerPerson', 'reportingFraction', 'importedSurgeSize']) {
      expect(typeof s[k], k).toBe('number')
    }
  })
})