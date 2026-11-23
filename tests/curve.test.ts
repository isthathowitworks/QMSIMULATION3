import { describe, expect, it } from 'vitest'
import type { RunResult } from '../src/engine/run'
import {
  compareRuns,
  mosquitoInfections,
  percentReduction,
  totalOf,
  weeklyTotals,
} from '../src/state/curve'

// a result with only the fields the comparison reads filled in
function makeResult(newInfections: number[], imported?: number[]): RunResult {
  const days = newInfections.length
  return {
    days,
    municipalityCount: 1,
    adults: new Int32Array(days),
    infectiousAdults: new Int32Array(days),
    cleanings: new Int32Array(days),
    newInfections: Int32Array.from(newInfections),
    imported: Int32Array.from(imported ?? new Array<number>(days).fill(0)),
    susceptible: new Int32Array(days),
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

  it('refuses two runs with a different number of days', () => {
    expect(() => compareRuns(makeResult([1, 2, 3]), makeResult([1, 2]))).toThrow(/different number of days/)
  })
})