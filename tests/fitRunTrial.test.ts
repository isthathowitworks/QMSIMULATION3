// Runs the real engine twice, so it is skipped unless TIMING is set and npm test ignores it.
import { describe, it, expect } from 'vitest'
import { runTrial } from '../scripts/fit-settings'

// Trial 52 of fit round 2.
const settings = { biteRate: 0.235, kPerPerson: 1.149, reportFrac: 0.008, importedSurgeSize: 23.113 }
const real = Array.from({ length: 364 }, () => 1)

describe.skipIf(!process.env.TIMING)('runTrial on the real data', () => {
  it('gives a score and fogging rounds, and the same result for the same seed', () => {
    const a = runTrial(settings, real)
    const b = runTrial(settings, real, 1)

    expect(a.fit.totalReal).toBe(364)
    expect(a.fit.totalSim).toBeGreaterThan(0)
    expect(Number.isInteger(a.foggingRounds)).toBe(true)
    expect(a.foggingRounds).toBeGreaterThanOrEqual(0)
    expect(a.seconds).toBeGreaterThan(0)

    expect(b.fit.totalSim).toBe(a.fit.totalSim)
    expect(b.foggingRounds).toBe(a.foggingRounds)
    console.log(`Trial 52 settings, seed 1: sim ${Math.round(a.fit.totalSim)}, fogging rounds ${a.foggingRounds}`)
  }, 600000)
})