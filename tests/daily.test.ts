import { describe, it, expect } from 'vitest'
import { createRng } from '../src/engine/rng'
import { createMosquitoes } from '../src/engine/mosquitoes'
import type { World } from '../src/engine/population'
import { DEFAULT_PARAMS } from '../src/engine/params'
import { makeCleaningOffsets } from '../src/engine/schedule'
import { mosquitoDay } from '../src/engine/daily'
import type { CleaningPlan } from '../src/engine/daily'

const H = 200

// A small stand-in world: only the household sizes are needed here.
function setup(seed: number, compliance: number, interval: number) {
  const householdSize = new Uint8Array(H).fill(5)
  const world = { householdSize } as unknown as World
  const m = createMosquitoes(world)
  const rng = createRng(seed)
  const intervals = new Int32Array(H).fill(interval)
  const plan: CleaningPlan = {
    intervals,
    offsets: makeCleaningOffsets(intervals, rng),
    compliance: new Float64Array(H).fill(compliance),
    out: new Uint8Array(H),
  }
  return { m, householdSize, plan, rng }
}

function totalAdults(m: { Sm: Int32Array; Im: Int32Array; em: Int32Array }): number {
  let n = 0
  for (const v of m.Sm) n += v
  for (const v of m.Im) n += v
  for (const v of m.em) n += v
  return n
}

describe('mosquitoDay', () => {
  it('returns the number of households that cleaned', () => {
    const { m, householdSize, plan, rng } = setup(1, 0.5, 1)
    const cleaned = mosquitoDay(m, householdSize, plan, 0, 28, 100, DEFAULT_PARAMS, rng)
    let ones = 0
    for (const v of plan.out) ones += v
    expect(cleaned).toBe(ones)
    expect(cleaned).toBeGreaterThan(0)
  })

  it('with 0 compliance, nobody cleans and breeding sites stay at full level', () => {
    const { m, householdSize, plan, rng } = setup(2, 0, 1)
    for (let day = 0; day < 10; day++) {
      expect(mosquitoDay(m, householdSize, plan, day, 28, 100, DEFAULT_PARAMS, rng)).toBe(0)
    }
    for (const s of m.site) expect(s).toBeCloseTo(1, 10)
  })

  it('cleaning cuts the breeding sites by half, then 10% of the gap comes back', () => {
    const { m, householdSize, plan, rng } = setup(3, 1, 1)
    mosquitoDay(m, householdSize, plan, 0, 28, 100, DEFAULT_PARAMS, rng)
    // 1 * 0.5 = 0.5, then 0.5 + 0.1 * (1 - 0.5) = 0.55
    for (const s of m.site) expect(s).toBeCloseTo(0.55, 10)
  })

  it('gives the same result for the same seed', () => {
    const run = (seed: number) => {
      const { m, householdSize, plan, rng } = setup(seed, 0.5, 7)
      for (let day = -30; day < 30; day++) {
        mosquitoDay(m, householdSize, plan, day, 28, 80, DEFAULT_PARAMS, rng)
      }
      return [Array.from(m.Sm), Array.from(m.imm)]
    }
    expect(run(11)).toEqual(run(11))
  })

  it('never makes a mosquito count negative or fractional', () => {
    const { m, householdSize, plan, rng } = setup(5, 0.5, 7)
    for (let day = -150; day < 50; day++) {
      mosquitoDay(m, householdSize, plan, day, 28, 100, DEFAULT_PARAMS, rng)
    }
    for (const arr of [m.imm, m.Sm, m.em, m.Im]) {
      for (const v of arr) {
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('adults increase in warm, wet weather with no cleaning', () => {
    const { m, householdSize, plan, rng } = setup(6, 0, 7)
    const before = totalAdults(m)
    for (let day = 0; day < 60; day++) {
      mosquitoDay(m, householdSize, plan, day, 28, 100, DEFAULT_PARAMS, rng)
    }
    expect(totalAdults(m)).toBeGreaterThan(before)
  })

  it('lays no eggs in cold weather, so no immatures remain', () => {
    const { m, householdSize, plan, rng } = setup(7, 0, 7)
    for (let day = 0; day < 30; day++) {
      mosquitoDay(m, householdSize, plan, day, 15, 100, DEFAULT_PARAMS, rng)
    }
    let immatures = 0
    for (const v of m.imm) immatures += v
    expect(immatures).toBe(0)
  })
})