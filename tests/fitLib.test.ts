import { describe, expect, it } from 'vitest'
import {
  FIT_KEYS,
  FIT_RANGES,
  YEAR_DAYS,
  latinHypercube,
  makeRandom,
  scoreFit,
  weeklyReported,
} from '../scripts/fit-lib'

describe('makeRandom', () => {
  it('gives the same numbers for the same seed, and numbers from 0 up to 1', () => {
    const a = makeRandom(5), b = makeRandom(5)
    for (let i = 0; i < 100; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('gives different numbers for a different seed', () => {
    expect(makeRandom(1)()).not.toBe(makeRandom(2)())
  })
})

describe('latinHypercube', () => {
  const n = 50
  const sample = latinHypercube(n, 1)

  it('gives n combinations with all four settings', () => {
    expect(sample.length).toBe(n)
    for (const s of sample) expect(Object.keys(s).sort()).toEqual([...FIT_KEYS].sort())
  })

  it('keeps every value inside its range', () => {
    for (const s of sample) {
      for (const key of FIT_KEYS) {
        const [lo, hi] = FIT_RANGES[key]
        expect(s[key]).toBeGreaterThanOrEqual(lo)
        expect(s[key]).toBeLessThanOrEqual(hi)
      }
    }
  })

  it('uses every slice of every range exactly once', () => {
    for (const key of FIT_KEYS) {
      const [lo, hi] = FIT_RANGES[key]
      const slices = sample.map((s) => Math.min(n - 1, Math.floor(((s[key] - lo) / (hi - lo)) * n)))
      expect([...slices].sort((x, y) => x - y)).toEqual(Array.from({ length: n }, (_, i) => i))
    }
  })

  it('is repeatable with the same seed and different with another seed', () => {
    expect(latinHypercube(n, 1)).toEqual(sample)
    expect(latinHypercube(n, 2)).not.toEqual(sample)
  })
})

describe('weeklyReported', () => {
  const M = 2
  const days = YEAR_DAYS.reduce((a, b) => a + b, 0)

  it('gives 52 weeks x 7 years = 364 values', () => {
    expect(weeklyReported(new Float64Array(days * M), M, 10, 0.25).length).toBe(364)
  })

  it('adds up one week over all municipalities and multiplies by scale x reportFrac', () => {
    const onsets = new Float64Array(days * M)
    onsets[0 * M + 0] = 1 // day 0, municipality 0
    onsets[3 * M + 1] = 2 // day 3, municipality 1 (same week)
    onsets[7 * M + 0] = 4 // day 7 = first day of week 2
    const w = weeklyReported(onsets, M, 10, 0.5)
    expect(w[0]).toBe((1 + 2) * 10 * 0.5)
    expect(w[1]).toBe(4 * 10 * 0.5)
    expect(w[2]).toBe(0)
  })

  it('starts each year on its own first day, and skips the extra days at the end of a year', () => {
    const onsets = new Float64Array(days * M)
    onsets[365 * M] = 1 // first day of 2020 -> week 1 of 2020 (slot 52)
    onsets[364 * M] = 100 // day 365 of 2019 (last day, beyond 52 weeks) -> not counted
    const w = weeklyReported(onsets, M, 1, 1)
    expect(w[52]).toBe(1)
    expect(w.reduce((a, b) => a + b, 0)).toBe(1)
  })
})

describe('scoreFit', () => {
  it('a perfect match gives error 0, correlation 1 and score 1 x 0 = 0', () => {
    const real = [1, 3, 2, 5, 4]
    const s = scoreFit(real, [...real])
    expect(s.rmse).toBe(0)
    expect(s.correlation).toBeCloseTo(1, 10)
    expect(s.score).toBeCloseTo(0, 10)
  })

  it('ignores weeks where the real value is null (gaps)', () => {
    const s = scoreFit([1, null, 3], [1, 999, 3])
    expect(s.rmse).toBe(0)
    expect(s.totalReal).toBe(4)
    expect(s.totalSim).toBe(4)
  })

  it('calculates RMSE, MAE and totals by hand', () => {
    const s = scoreFit([0, 0, 0, 4], [1, 1, 1, 1])
    expect(s.rmse).toBeCloseTo(Math.sqrt((1 + 1 + 1 + 9) / 4), 10)
    expect(s.mae).toBeCloseTo((1 + 1 + 1 + 3) / 4, 10)
    expect(s.totalReal).toBe(4)
    expect(s.totalSim).toBe(4)
  })

  it('a wrong timing scores worse than a right timing with the same errors', () => {
    const real = [0, 0, 5, 0, 0]
    const right = scoreFit(real, [0, 0, 4, 0, 0])
    const late = scoreFit(real, [0, 0, 0, 4, 0])
    expect(late.score).toBeGreaterThan(right.score)
  })

  it('a flat simulation has no correlation (NaN) and counts as 0 in the score', () => {
    const s = scoreFit([1, 2, 3], [2, 2, 2])
    expect(Number.isNaN(s.correlation)).toBe(true)
    expect(s.score).toBeCloseTo(s.rmse * 2, 10)
  })

  it('throws when there is no real data at all', () => {
    expect(() => scoreFit([null, null], [1, 2])).toThrow()
  })
})