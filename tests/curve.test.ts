import { describe, expect, it } from 'vitest'
import type { RunResult } from '../src/engine/run'
import {
  compareRuns,
  mosquitoInfections,
  peopleIn,
  percentReduction,
  perPersonWeekly,
  totalOf,
  weeklyAverages,
  weeklyTotals,
} from '../src/state/curve'

interface Extra {
  adults?: number[] // mosquitoes, one number per day
  immatures?: number[]
  people?: number // simulated people, all susceptible
}

// a result with only the fields the comparison reads filled in
function makeResult(newInfections: number[], imported?: number[], extra: Extra = {}): RunResult {
  const days = newInfections.length
  return {
    days,
    municipalityCount: 1,
    adults: extra.adults ? Int32Array.from(extra.adults) : new Int32Array(days),
    immatures: extra.immatures ? Int32Array.from(extra.immatures) : new Int32Array(days),
    infectiousAdults: new Int32Array(days),
    cleanings: new Int32Array(days),
    newInfections: Int32Array.from(newInfections),
    imported: Int32Array.from(imported ?? new Array<number>(days).fill(0)),
    susceptible: new Int32Array(days).fill(extra.people ?? 0),
    exposed: new Int32Array(days),
    infectious: new Int32Array(days),
    recovered: new Int32Array(days),
    onsets: new Int32Array(days),
    fogged: new Uint8Array(days),
    foggingRounds: new Int32Array(1),
  }
}

describe('mosquitoInfections', () => {
  it('takes the imported people off the new infections, day by day', () => {
    const r = makeResult([5, 3, 4], [1, 0, 4])
    expect(Array.from(mosquitoInfections(r))).toEqual([4, 3, 0])
  })
})

describe('totalOf', () => {
  it('adds everything up', () => {
    expect(totalOf([1, 2, 3, 4])).toBe(10)
    expect(totalOf([])).toBe(0)
  })
})

describe('weeklyTotals', () => {
  it('adds up blocks of 7 days and keeps a short last block', () => {
    const daily = [...new Array<number>(7).fill(2), ...new Array<number>(7).fill(1), 5]
    expect(weeklyTotals(daily)).toEqual([14, 7, 5])
  })

  it('gives nothing for no days', () => {
    expect(weeklyTotals([])).toEqual([])
  })
})

describe('weeklyAverages', () => {
  it('averages each block of 7 days', () => {
    const daily = [...new Array<number>(7).fill(2), ...new Array<number>(7).fill(4)]
    expect(weeklyAverages(daily)).toEqual([2, 4])
  })

  it('averages a short last block over the days it has', () => {
    const daily = [...new Array<number>(7).fill(2), 6, 6, 6]
    expect(weeklyAverages(daily)).toEqual([2, 6])
  })

  it('gives nothing for no days', () => {
    expect(weeklyAverages([])).toEqual([])
  })
})

describe('peopleIn', () => {
  it('adds up the four states on day 0', () => {
    const r = makeResult([0, 0])
    r.susceptible[0] = 10
    r.exposed[0] = 2
    r.infectious[0] = 1
    r.recovered[0] = 3
    expect(peopleIn(r)).toBe(16)
  })

  it('is 0 for a run with no days', () => {
    expect(peopleIn(makeResult([]))).toBe(0)
  })
})

describe('perPersonWeekly', () => {
  it('averages each week and divides by the number of people', () => {
    const daily = new Array<number>(14).fill(40)
    expect(perPersonWeekly(daily, 10)).toEqual([4, 4])
  })

  it('gives 0 for every week when there are no people', () => {
    const daily = new Array<number>(14).fill(40)
    expect(perPersonWeekly(daily, 0)).toEqual([0, 0])
  })
})

describe('percentReduction', () => {
  it('is the share by which the policy is below the baseline', () => {
    expect(percentReduction(100, 75)).toBe(25)
    expect(percentReduction(100, 100)).toBe(0)
  })

  it('is negative when the policy is worse', () => {
    expect(percentReduction(100, 120)).toBeCloseTo(-20, 10)
  })

  it('is null when the baseline has no infections', () => {
    expect(percentReduction(0, 0)).toBeNull()
    expect(percentReduction(0, 5)).toBeNull()
  })
})

describe('compareRuns', () => {
  it('gives weekly curves, totals and the reduction, leaving imports out', () => {
    const baseline = makeResult(new Array<number>(14).fill(10), new Array<number>(14).fill(0))
    const policy = makeResult(new Array<number>(14).fill(6), new Array<number>(14).fill(1))
    const c = compareRuns(baseline, policy)
    expect(c.baselineWeekly).toEqual([70, 70])
    expect(c.policyWeekly).toEqual([35, 35])
    expect(c.baselineTotal).toBe(140)
    expect(c.policyTotal).toBe(70)
    expect(c.percentReduction).toBe(50)
  })

  it('gives weekly adults and immatures per person for both runs', () => {
    const zeros = new Array<number>(14).fill(0)
    const baseline = makeResult(zeros, zeros, {
      adults: new Array<number>(14).fill(80),
      immatures: new Array<number>(14).fill(200),
      people: 10,
    })
    const policy = makeResult(zeros, zeros, {
      adults: new Array<number>(14).fill(30),
      immatures: new Array<number>(14).fill(50),
      people: 10,
    })
    const c = compareRuns(baseline, policy)
    expect(c.baselineAdultsPerPerson).toEqual([8, 8])
    expect(c.policyAdultsPerPerson).toEqual([3, 3])
    expect(c.baselineImmaturesPerPerson).toEqual([20, 20])
    expect(c.policyImmaturesPerPerson).toEqual([5, 5])
  })

  it('refuses two runs with a different number of days', () => {
    expect(() => compareRuns(makeResult([1, 2, 3]), makeResult([1, 2]))).toThrow(/different number of days/)
  })
})