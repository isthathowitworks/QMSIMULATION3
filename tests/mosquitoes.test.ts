import { describe, it, expect } from 'vitest'
import { buildWorld } from '../src/engine/population'
import type { PopulationFile } from '../src/engine/population'
import { createMosquitoes, LMAX, EMAX } from '../src/engine/mosquitoes'

// A tiny made-up world: 3 households of 5, 5 and 4 people, then 1 household of 6.
const file: PopulationFile = {
  peoplePerSimPerson: 10,
  peoplePerHousehold: 5,
  barangays: [
    { municipality: 'A', barangay: 'One', population: 140, simPeople: 14, households: 3 },
    { municipality: 'A', barangay: 'Two', population: 60, simPeople: 6, households: 1 },
  ],
}

describe('createMosquitoes', () => {
  const world = buildWorld(file)
  const m = createMosquitoes(world)

  it('has one row per household in every array', () => {
    expect(m.households).toBe(4)
    expect(m.Sm.length).toBe(4)
    expect(m.Im.length).toBe(4)
    expect(m.site.length).toBe(4)
    expect(m.imm.length).toBe(4 * LMAX)
    expect(m.em.length).toBe(4 * EMAX)
  })

  it('household sizes are what the test expects (5, 5, 4, 6)', () => {
    expect(Array.from(world.householdSize)).toEqual([5, 5, 4, 6])
  })

  it('starts with round(size x 1.5) susceptible adults (8, 8, 6, 9)', () => {
    expect(Array.from(m.Sm)).toEqual([8, 8, 6, 9])
  })

  it('starts with no immatures, no exposed and no infectious mosquitoes', () => {
    expect(m.imm.every((x) => x === 0)).toBe(true)
    expect(m.em.every((x) => x === 0)).toBe(true)
    expect(m.Im.every((x) => x === 0)).toBe(true)
  })

  it('starts with breeding sites at full level (1)', () => {
    expect(m.site.every((x) => x === 1)).toBe(true)
  })

  it('adultsPerPerson changes the starting adults (2 per person gives 10, 10, 8, 12)', () => {
    const m2 = createMosquitoes(world, 2)
    expect(Array.from(m2.Sm)).toEqual([10, 10, 8, 12])
  })
})