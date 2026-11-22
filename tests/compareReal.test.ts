import { describe, it, expect } from 'vitest'
import { compareYears, sumRange } from '../scripts/compare-lib'

// Three "years" of 3 weeks each, to keep the numbers easy to check by hand.
const real = [1, 5, 2, null, null, null, 0, 0, 0]
const sim = [1, 2, 3, 4, 4, 4, 0, 0, 1]

describe('compareYears', () => {
  const rows = compareYears(real, sim, 2019, 3)

  it('gives one row per year, numbered from the first year', () => {
    expect(rows.map((r) => r.year)).toEqual([2019, 2020, 2021])
  })

  it('adds up real and simulated cases per year', () => {
    expect(rows[0].realTotal).toBe(8)
    expect(rows[0].simTotal).toBe(6)
    expect(rows[2].realTotal).toBe(0)
    expect(rows[2].simTotal).toBe(1)
  })

  it('finds the peak week (1 to 3) and its cases', () => {
    expect(rows[0].realPeakWeek).toBe(2)
    expect(rows[0].realPeakCases).toBe(5)
    expect(rows[0].simPeakWeek).toBe(3)
    expect(rows[0].simPeakCases).toBe(3)
  })

  it('takes the first week when several weeks tie for the peak', () => {
    expect(rows[1].simPeakWeek).toBe(1)
  })

  it('shows a year with no real records as a gap, not as zero', () => {
    expect(rows[1].realTotal).toBeNull()
    expect(rows[1].realPeakWeek).toBeNull()
    expect(rows[1].realPeakCases).toBeNull()
    expect(rows[1].simTotal).toBe(12)
  })

  it('gives no peak week for a year with no cases', () => {
    expect(rows[2].realTotal).toBe(0)
    expect(rows[2].realPeakWeek).toBeNull()
  })

  it('throws when real and simulated have different lengths', () => {
    expect(() => compareYears([1, 2, 3], [1, 2], 2019, 3)).toThrow('compareYears')
  })
})

describe('sumRange', () => {
  it('adds the values from start up to, not including, end', () => {
    expect(sumRange([1, 2, 3, 4], 0, 2)).toBe(3)
    expect(sumRange([1, 2, 3, 4], 1, 4)).toBe(9)
  })

  it('counts a null week as 0', () => {
    expect(sumRange([1, null, 3], 0, 3)).toBe(4)
  })

  it('gives 0 for an empty range', () => {
    expect(sumRange([1, 2, 3], 2, 2)).toBe(0)
  })

  it('stops at the end of the list', () => {
    expect(sumRange([1, 2, 3], 1, 10)).toBe(5)
  })
})