import { describe, it, expect } from 'vitest'
import { rescore } from '../scripts/rescore-fit'
import type { SavedTrial } from '../scripts/rescore-fit'

const settings = { biteRate: 0.2, kPerPerson: 1, reportFrac: 0.1, importedSurgeSize: 5 }

function trial(n: number, correlation: number | null, totalSim: number): SavedTrial {
  return { trial: n, settings, fit: { correlation, totalReal: 470, totalSim, rmse: 1 } }
}

describe('rescore', () => {
  it('sorts best (lowest scoreV2) first', () => {
    const ranked = rescore([trial(1, 0.9, 4000), trial(2, 0.9, 500), trial(3, 0.9, 1500)])
    expect(ranked.map((t) => t.trial)).toEqual([2, 3, 1])
  })

  it('puts a flat series below a shape-right one', () => {
    const ranked = rescore([trial(1, 0.096, 274), trial(2, 0.885, 1536)])
    expect(ranked[0].trial).toBe(2)
  })

  it('treats a saved null correlation as 0', () => {
    const ranked = rescore([trial(1, null, 470)])
    expect(ranked[0].scoreV2).toBeCloseTo(2, 10)
  })

  it('puts a trial with no simulated cases last', () => {
    const ranked = rescore([trial(1, 0.9, 0), trial(2, 0.1, 470)])
    expect(ranked[1].trial).toBe(1)
    expect(ranked[1].scoreV2).toBe(Infinity)
  })

  it('does not change the input order', () => {
    const input = [trial(1, 0.9, 4000), trial(2, 0.9, 500)]
    rescore(input)
    expect(input.map((t) => t.trial)).toEqual([1, 2])
  })
})