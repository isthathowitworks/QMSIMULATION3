import { describe, it, expect } from 'vitest'
import { buildWorld } from '../src/engine/population'
import type { PopulationFile } from '../src/engine/population'
import { createMosquitoes, LMAX, EMAX } from '../src/engine/mosquitoes'
import { adultDeath, layEggs } from '../src/engine/lifecycle'
import { createRng } from '../src/engine/rng'

// Same tiny made-up world as before: households of 5, 5, 4 and 6 people.
const file: PopulationFile = {
  peoplePerSimPerson: 10,
  peoplePerHousehold: 5,
  barangays: [
    { municipality: 'A', barangay: 'One', population: 140, simPeople: 14, households: 3 },
    { municipality: 'A', barangay: 'Two', population: 60, simPeople: 6, households: 1 },
  ],
}

const world = buildWorld(file)
const fresh = () => createMosquitoes(world)

describe('adultDeath', () => {
  it('mortality 0 changes nothing and mortality 1 removes every adult', () => {
    const a = fresh()
    a.Im[0] = 5
    a.em[0 * EMAX + 3] = 9
    adultDeath(a, 0, createRng(1))
    expect(Array.from(a.Sm)).toEqual([8, 8, 6, 9])
    expect(a.Im[0]).toBe(5)
    expect(a.em[3]).toBe(9)

    const b = fresh()
    b.Im[0] = 5
    b.em[0 * EMAX + 3] = 9
    adultDeath(b, 1, createRng(1))
    expect(b.Sm.every((x) => x === 0)).toBe(true)
    expect(b.Im.every((x) => x === 0)).toBe(true)
    expect(b.em.every((x) => x === 0)).toBe(true)
  })

  it('kills about 30% of susceptible, exposed and infectious adults at mortality 0.3', () => {
    const m = fresh()
    m.Sm[0] = 1000
    m.Im[0] = 1000
    m.em[0 * EMAX + 3] = 1000
    adultDeath(m, 0.3, createRng(2))
    for (const x of [m.Sm[0], m.Im[0], m.em[3]]) {
      expect(x).toBeGreaterThan(640)
      expect(x).toBeLessThan(760)
    }
  })

  it('does not touch immatures', () => {
    const m = fresh()
    m.imm[0 * LMAX + 5] = 50
    adultDeath(m, 0.5, createRng(3))
    expect(m.imm[5]).toBe(50)
  })

  it('never takes a count below zero', () => {
    const m = fresh()
    const rng = createRng(4)
    for (let day = 0; day < 40; day++) adultDeath(m, 0.5, rng)
    expect(m.Sm.every((x) => x >= 0)).toBe(true)
  })
})

describe('layEggs', () => {
  it('lays nothing when the egg rate is 0', () => {
    const m = fresh()
    layEggs(m, world.householdSize, createRng(5), 0, 1)
    for (let h = 0; h < 4; h++) expect(m.imm[h * LMAX]).toBe(0)
  })

  it('uncrowded household: about 800 eggs, 90% survive (about 720 at age 0)', () => {
    const m = fresh()
    m.Sm[0] = 1000
    layEggs(m, world.householdSize, createRng(6), 0.8, 1)
    expect(m.imm[0]).toBeGreaterThan(600)
    expect(m.imm[0]).toBeLessThan(840)
  })

  it('crowded household: many larvae already there, so few new eggs survive', () => {
    const m = fresh()
    m.Sm[0] = 1000
    m.imm[0 * LMAX + 5] = 120 // capacity is 12, so survival drops to about 8%
    layEggs(m, world.householdSize, createRng(7), 0.8, 1)
    expect(m.imm[0]).toBeGreaterThan(20)
    expect(m.imm[0]).toBeLessThan(120)
  })

  it('leaves older immatures and adults as they were', () => {
    const m = fresh()
    m.Sm[0] = 1000
    m.imm[0 * LMAX + 5] = 120
    layEggs(m, world.householdSize, createRng(8), 0.8, 1)
    expect(m.imm[5]).toBe(120)
    expect(m.Sm[0]).toBe(1000)
  })

  it('cleaned breeding sites recover 10% of the gap to full each day', () => {
    const m = fresh()
    m.site[0] = 0.5
    layEggs(m, world.householdSize, createRng(9), 0.8, 1)
    expect(m.site[0]).toBeCloseTo(0.55, 10)
    expect(m.site[1]).toBe(1)
  })

  it('a household with low breeding sites keeps fewer of its eggs', () => {
    const m = fresh()
    m.Sm[0] = 1000
    m.Sm[1] = 1000
    m.imm[0 * LMAX + 5] = 12
    m.imm[1 * LMAX + 5] = 12
    m.site[1] = 0.1
    layEggs(m, world.householdSize, createRng(10), 0.8, 1)
    expect(m.imm[0 * LMAX]).toBeGreaterThan(m.imm[1 * LMAX] + 100)
  })

  it('exposed and infectious adults lay eggs too', () => {
    const m = fresh()
    m.Sm[0] = 0
    m.Im[0] = 500
    m.em[0 * EMAX + 2] = 500
    layEggs(m, world.householdSize, createRng(11), 0.8, 1)
    expect(m.imm[0]).toBeGreaterThan(500)
  })
})