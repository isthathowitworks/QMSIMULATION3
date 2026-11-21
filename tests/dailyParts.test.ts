import { describe, it, expect } from 'vitest'
import { createRng } from '../src/engine/rng'
import { createMosquitoes } from '../src/engine/mosquitoes'
import type { World } from '../src/engine/population'
import { DEFAULT_PARAMS } from '../src/engine/params'
import { makeCleaningOffsets } from '../src/engine/schedule'
import { mosquitoDay, dayStart, dayAdultDeath, dayEggs } from '../src/engine/daily'
import type { CleaningPlan } from '../src/engine/daily'

const H = 200

function setup(seed: number) {
  const householdSize = new Uint8Array(H).fill(5)
  const world = { householdSize } as unknown as World
  const m = createMosquitoes(world)
  const rng = createRng(seed)
  const intervals = new Int32Array(H).fill(7)
  const plan: CleaningPlan = {
    intervals,
    offsets: makeCleaningOffsets(intervals, rng),
    compliance: new Float64Array(H).fill(0.5),
    out: new Uint8Array(H),
  }
  return { m, householdSize, plan, rng }
}

// Weather that changes from day to day, so every branch gets used.
const tempOn = (day: number) => 24 + 6 * Math.sin(day / 11)
const rainOn = (day: number) => 60 + 50 * Math.cos(day / 17)

describe('mosquitoDay split into parts', () => {
  it('dayStart, dayAdultDeath and dayEggs together match mosquitoDay exactly', () => {
    const a = setup(21)
    const b = setup(21)
    for (let day = -50; day < 50; day++) {
      const t = tempOn(day)
      const r = rainOn(day)
      const cleanedA = mosquitoDay(a.m, a.householdSize, a.plan, day, t, r, DEFAULT_PARAMS, a.rng)
      const cleanedB = dayStart(b.m, b.plan, day, t, DEFAULT_PARAMS, b.rng)
      dayAdultDeath(b.m, t, b.rng)
      dayEggs(b.m, b.householdSize, t, r, DEFAULT_PARAMS, b.rng)
      expect(cleanedB).toBe(cleanedA)
    }
    expect(Array.from(b.m.imm)).toEqual(Array.from(a.m.imm))
    expect(Array.from(b.m.Sm)).toEqual(Array.from(a.m.Sm))
    expect(Array.from(b.m.Im)).toEqual(Array.from(a.m.Im))
    expect(Array.from(b.m.em)).toEqual(Array.from(a.m.em))
    expect(Array.from(b.m.site)).toEqual(Array.from(a.m.site))
    // same number of random draws used, in the same order
    expect(b.rng.next()).toBe(a.rng.next())
  })

  it('dayStart returns the number of households that cleaned', () => {
    const { m, plan, rng } = setup(22)
    const cleaned = dayStart(m, plan, 0, 28, DEFAULT_PARAMS, rng)
    let ones = 0
    for (const v of plan.out) ones += v
    expect(cleaned).toBe(ones)
    expect(cleaned).toBeGreaterThan(0)
  })
})