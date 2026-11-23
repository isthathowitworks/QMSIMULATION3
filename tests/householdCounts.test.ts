import { describe, expect, it } from 'vitest'
import { householdStateCounts } from '../src/state/householdCounts'

// 6 households: two in A, three in B, one in C; D has none
const municipalityOf = Uint8Array.from([0, 0, 1, 1, 1, 2])
const names = ['A', 'B', 'C', 'D']

// 2 weeks of 6 households: 0 susceptible, 1 exposed, 2 infectious, 3 recovered
const states = Uint8Array.from([0, 1, 2, 3, 2, 0, /* week 1 */ 2, 2, 2, 0, 0, 0])

describe('householdStateCounts', () => {
  it('counts the households in each state for each municipality in week 0', () => {
    const counts = householdStateCounts(municipalityOf, names, states, 0)
    expect(counts).not.toBeNull()
    // A: household 0 susceptible, household 1 exposed
    expect(counts?.[0]).toEqual({ name: 'A', households: 2, susceptible: 1, exposed: 1, infectious: 0, recovered: 0 })
    // B: households 2 and 4 infectious, household 3 recovered
    expect(counts?.[1]).toEqual({ name: 'B', households: 3, susceptible: 0, exposed: 0, infectious: 2, recovered: 1 })
    // C: household 5 susceptible
    expect(counts?.[2]).toEqual({ name: 'C', households: 1, susceptible: 1, exposed: 0, infectious: 0, recovered: 0 })
  })

  it('counts the week it is given', () => {
    const counts = householdStateCounts(municipalityOf, names, states, 1)
    expect(counts?.[0]).toEqual({ name: 'A', households: 2, susceptible: 0, exposed: 0, infectious: 2, recovered: 0 })
    expect(counts?.[1]).toEqual({ name: 'B', households: 3, susceptible: 2, exposed: 0, infectious: 1, recovered: 0 })
    expect(counts?.[2]).toEqual({ name: 'C', households: 1, susceptible: 1, exposed: 0, infectious: 0, recovered: 0 })
  })

  it('gives one entry per name, in the order of the names', () => {
    const counts = householdStateCounts(municipalityOf, names, states, 0)
    expect(counts?.map((c) => c.name)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('gives zeros for a municipality with no households', () => {
    const counts = householdStateCounts(municipalityOf, names, states, 0)
    expect(counts?.[3]).toEqual({ name: 'D', households: 0, susceptible: 0, exposed: 0, infectious: 0, recovered: 0 })
  })

  it('adds the four states up to the households of each municipality, and all of them to every household', () => {
    for (const week of [0, 1]) {
      const counts = householdStateCounts(municipalityOf, names, states, week) ?? []
      for (const c of counts) {
        expect(c.susceptible + c.exposed + c.infectious + c.recovered).toBe(c.households)
      }
      expect(counts.reduce((sum, c) => sum + c.households, 0)).toBe(6)
    }
  })

  it('works with plain arrays as well as typed arrays', () => {
    const counts = householdStateCounts([0, 1], ['A', 'B'], [2, 3], 0)
    expect(counts?.[0].infectious).toBe(1)
    expect(counts?.[1].recovered).toBe(1)
  })

  it('gives null when the week is not one of the weeks', () => {
    for (const week of [2, -1, 0.5, Number.NaN]) {
      expect(householdStateCounts(municipalityOf, names, states, week)).toBeNull()
    }
  })

  it('gives null when the states are too short for the households', () => {
    expect(householdStateCounts(municipalityOf, names, states.slice(0, 5), 0)).toBeNull()
    expect(householdStateCounts(municipalityOf, names, states.slice(0, 9), 1)).toBeNull()
  })

  it('gives null when a household points at a municipality that is not in the names', () => {
    expect(householdStateCounts(Uint8Array.from([0, 0, 1, 1, 1, 7]), names, states, 0)).toBeNull()
  })

  it('gives null when a state code is not 0 to 3', () => {
    expect(householdStateCounts(municipalityOf, names, Uint8Array.from([0, 1, 2, 3, 4, 0]), 0)).toBeNull()
  })

  it('gives zeros for every name when there are no households', () => {
    const counts = householdStateCounts(new Uint8Array(0), ['A'], new Uint8Array(0), 0)
    expect(counts).toEqual([{ name: 'A', households: 0, susceptible: 0, exposed: 0, infectious: 0, recovered: 0 }])
  })
})