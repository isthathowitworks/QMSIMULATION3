import { describe, it, expect } from 'vitest'
import { FIT_KEYS, FIT_RANGES, latinHypercube } from '../scripts/fit-lib'
import type { FitRanges } from '../scripts/fit-lib'

const round2: FitRanges = {
  biteRate: [0.1, 0.3],
  kPerPerson: [0.5, 3.0],
  reportFrac: [0.005, 0.15],
  importedSurgeSize: [0, 40],
}

describe('latinHypercube with custom ranges', () => {
  it('keeps every value inside the given ranges', () => {
    for (const s of latinHypercube(40, 5, round2)) {
      for (const key of FIT_KEYS) {
        expect(s[key]).toBeGreaterThanOrEqual(round2[key][0])
        expect(s[key]).toBeLessThanOrEqual(round2[key][1])
      }
    }
  })

  it('uses every slice of each range exactly once', () => {
    const n = 20
    const sample = latinHypercube(n, 2, round2)
    for (const key of FIT_KEYS) {
      const [lo, hi] = round2[key]
      const slices = sample.map((s) => Math.floor(((s[key] - lo) / (hi - lo)) * n)).sort((a, b) => a - b)
      expect(slices).toEqual(Array.from({ length: n }, (_, i) => i))
    }
  })

  it('gives the same result as before when no ranges are passed', () => {
    expect(latinHypercube(10, 3)).toEqual(latinHypercube(10, 3, FIT_RANGES))
  })

  it('gives different values for different ranges with the same seed', () => {
    expect(latinHypercube(10, 3, round2)).not.toEqual(latinHypercube(10, 3))
  })
})