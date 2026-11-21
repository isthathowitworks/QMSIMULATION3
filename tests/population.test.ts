import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildWorld, SUSCEPTIBLE, type PopulationFile } from '../src/engine/population'

const file: PopulationFile = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'population.json'), 'utf8'))
const w = buildWorld(file)

describe('buildWorld', () => {
  it('has 39 barangays in 12 municipalities', () => {
    expect(w.barangays.length).toBe(39)
    expect(w.municipalities.length).toBe(12)
  })

  it('has 18,986 people in 3,797 households', () => {
    expect(w.personState.length).toBe(18986)
    expect(w.householdSize.length).toBe(3797)
  })

  it('household sizes add up to the number of people', () => {
    const total = w.householdSize.reduce((s, n) => s + n, 0)
    expect(total).toBe(w.personState.length)
  })

  it('every household has 4 to 6 people', () => {
    for (const size of w.householdSize) {
      expect(size).toBeGreaterThanOrEqual(4)
      expect(size).toBeLessThanOrEqual(6)
    }
  })

  it('every person sits inside the household they point to', () => {
    for (let p = 0; p < w.personHousehold.length; p++) {
      const h = w.personHousehold[p]
      expect(p).toBeGreaterThanOrEqual(w.householdFirstPerson[h])
      expect(p).toBeLessThan(w.householdFirstPerson[h] + w.householdSize[h])
    }
  })

  it('each barangay has the household count from the file', () => {
    file.barangays.forEach((b, i) => {
      expect(w.barangays[i].householdCount).toBe(b.households)
    })
  })

  it('everyone starts susceptible', () => {
    expect(w.personState.every((s) => s === SUSCEPTIBLE)).toBe(true)
  })
})