import { describe, it, expect } from 'vitest'
import { scoreV2 } from '../scripts/fit-lib'

describe('scoreV2', () => {
  it('is 0 for a perfect match', () => {
    expect(scoreV2({ correlation: 1, totalReal: 470, totalSim: 470 })).toBeCloseTo(0, 10)
  })

  it('counts 2x too high and 2x too low the same', () => {
    const high = scoreV2({ correlation: 0.9, totalReal: 100, totalSim: 200 })
    const low = scoreV2({ correlation: 0.9, totalReal: 100, totalSim: 50 })
    expect(high).toBeCloseTo(low, 10)
  })

  it('adds the shape part and the size part', () => {
    // shape = 2 x (1 - 0.5) = 1, size = |ln(2)|
    expect(scoreV2({ correlation: 0.5, totalReal: 100, totalSim: 200 })).toBeCloseTo(1 + Math.log(2), 10)
  })

  it('counts a correlation that cannot be calculated as 0', () => {
    expect(scoreV2({ correlation: NaN, totalReal: 100, totalSim: 100 })).toBeCloseTo(2, 10)
  })

  it('gives Infinity when nothing was simulated', () => {
    expect(scoreV2({ correlation: 0.9, totalReal: 100, totalSim: 0 })).toBe(Infinity)
  })

  it('gives Infinity when there are no real cases', () => {
    expect(scoreV2({ correlation: 0.9, totalReal: 0, totalSim: 50 })).toBe(Infinity)
  })

  it('ranks the shape-right trial 25 above the flat trial 16 from the first fit', () => {
    const trial16 = scoreV2({ correlation: 0.096, totalReal: 470, totalSim: 274 })
    const trial25 = scoreV2({ correlation: 0.885, totalReal: 470, totalSim: 1536 })
    expect(trial25).toBeLessThan(trial16)
  })
})