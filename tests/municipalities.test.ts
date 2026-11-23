import { describe, it, expect } from 'vitest'
import {
  biteTotalsPerMunicipality,
  municipalityDetails,
  municipalityPeople,
  perThousand,
} from '../src/state/municipalities'

describe('biteTotalsPerMunicipality', () => {
  it('adds up each municipality over the days', () => {
    // 3 days, 2 municipalities: day 1 = 1 and 2, day 2 = 3 and 4, day 3 = 5 and 6
    const totals = biteTotalsPerMunicipality([1, 2, 3, 4, 5, 6], 2)
    expect(totals).toEqual([9, 12]) // 1+3+5 and 2+4+6
  })

  it('works with the typed array that the engine hands over', () => {
    // 2 days, 3 municipalities: day 1 = 0, 7, 0 and day 2 = 0, 2, 1
    const totals = biteTotalsPerMunicipality(new Int32Array([0, 7, 0, 0, 2, 1]), 3)
    expect(totals).toEqual([0, 9, 1]) // 0+0, 7+2, 0+1
  })

  it('gives zeros when there are no days', () => {
    expect(biteTotalsPerMunicipality([], 4)).toEqual([0, 0, 0, 0])
  })

  it('throws when the municipality count is not a whole number of at least 1', () => {
    expect(() => biteTotalsPerMunicipality([1, 2], 0)).toThrow('municipalityCount')
    expect(() => biteTotalsPerMunicipality([1, 2], 1.5)).toThrow('municipalityCount')
  })

  it('throws when the array is not a whole number of days', () => {
    expect(() => biteTotalsPerMunicipality([1, 2, 3], 2)).toThrow('whole number of days')
  })
})

describe('municipalityPeople', () => {
  it('keeps the order of first appearance and adds up the simulated people', () => {
    const population = {
      barangays: [
        { municipality: 'A', simPeople: 100, households: 20 },
        { municipality: 'B', simPeople: 50, households: 10 },
        { municipality: 'A', simPeople: 20, households: 4 },
        { municipality: 'C', simPeople: 30, households: 6 },
        { municipality: 'B', simPeople: 5, households: 1 },
      ],
    }
    const result = municipalityPeople(population)
    expect(result.names).toEqual(['A', 'B', 'C'])
    expect(result.simPeople).toEqual([120, 55, 30]) // A 100+20, B 50+5, C 30
  })

  it('gives empty lists for a file with no barangays', () => {
    expect(municipalityPeople({ barangays: [] })).toEqual({ names: [], simPeople: [] })
  })
})

describe('perThousand', () => {
  it('gives bite infections per 1,000 simulated people', () => {
    const result = perThousand([6, 3, 5], [200, 1000, 500])
    expect(result[0]).toBeCloseTo(30, 10) // 6 / 200 * 1000
    expect(result[1]).toBeCloseTo(3, 10) // 3 / 1000 * 1000
    expect(result[2]).toBeCloseTo(10, 10) // 5 / 500 * 1000
  })

  it('gives 0 for a municipality with no people', () => {
    expect(perThousand([4, 0], [0, 0])).toEqual([0, 0])
  })

  it('throws when the two lists have different lengths', () => {
    expect(() => perThousand([1, 2], [100])).toThrow('2 totals but 1 population')
  })
})

describe('municipalityDetails', () => {
  const population = {
    barangays: [
      { municipality: 'A', simPeople: 100, households: 20 },
      { municipality: 'B', simPeople: 50, households: 10 },
      { municipality: 'A', simPeople: 100, households: 20 },
    ],
  }

  it('gives the name, people, infections and infections per 1,000 for each municipality', () => {
    // A has 200 simulated people (100+100), B has 50
    const details = municipalityDetails(population, [20, 5])
    expect(details).toHaveLength(2)
    expect(details[0].name).toBe('A')
    expect(details[0].people).toBe(200)
    expect(details[0].infections).toBe(20)
    expect(details[0].perThousand).toBeCloseTo(100, 10) // 20 / 200 * 1000
    expect(details[1].name).toBe('B')
    expect(details[1].people).toBe(50)
    expect(details[1].infections).toBe(5)
    expect(details[1].perThousand).toBeCloseTo(100, 10) // 5 / 50 * 1000
  })

  it('keeps the order of first appearance in the population file', () => {
    const details = municipalityDetails(population, [0, 0])
    expect(details.map((d) => d.name)).toEqual(['A', 'B'])
  })

  it('gives the same per 1,000 numbers as perThousand', () => {
    const totals = [13, 4]
    const details = municipalityDetails(population, totals)
    const expected = perThousand(totals, [200, 50])
    expect(details.map((d) => d.perThousand)).toEqual(expected)
  })

  it('gives an empty list for a file with no barangays', () => {
    expect(municipalityDetails({ barangays: [] }, [])).toEqual([])
  })

  it('throws when the number of totals does not match the number of municipalities', () => {
    expect(() => municipalityDetails(population, [1, 2, 3])).toThrow('3 totals but 2 population')
    expect(() => municipalityDetails(population, [1])).toThrow('1 totals but 2 population')
  })
})