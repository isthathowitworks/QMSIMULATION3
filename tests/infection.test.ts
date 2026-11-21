import { describe, it, expect } from 'vitest'
import { createRng } from '../src/engine/rng'
import { createMosquitoes, EMAX } from '../src/engine/mosquitoes'
import type { Mosquitoes } from '../src/engine/mosquitoes'
import type { World } from '../src/engine/population'
import { DEFAULT_PARAMS } from '../src/engine/params'
import { eipDays } from '../src/engine/biology'
import { mosquitoInfection } from '../src/engine/infection'

// Small fake world: only householdSize is needed to build mosquitoes.
function makeMosquitoes(households: number, size = 5): Mosquitoes {
  const world = { householdSize: new Int32Array(households).fill(size) } as unknown as World
  return createMosquitoes(world, 1.5)
}

function totalMosquitoes(m: Mosquitoes): number {
  let t = 0
  for (let h = 0; h < m.households; h++) t += m.Sm[h] + m.Im[h]
  for (let i = 0; i < m.em.length; i++) t += m.em[i]
  return t
}

const zeros = (n: number) => new Int32Array(n)

describe('mosquitoInfection (2.5a)', () => {
  it('uses eipDays 10 at 28 C (sanity check for the tests below)', () => {
    expect(eipDays(28)).toBe(10)
    expect(eipDays(20)).toBe(13)
  })

  it('exposed mosquitoes at the end of incubation become infectious', () => {
    const m = makeMosquitoes(1)
    m.em[10] = 5 // already waited 10 days
    m.em[9] = 3 // one day short
    mosquitoInfection(m, zeros(1), zeros(1).fill(5), 28, DEFAULT_PARAMS, createRng(1))
    expect(m.Im[0]).toBe(5)
    expect(m.em[10]).toBe(3) // the 9-day group is now 10 days old
    expect(m.em[9]).toBe(0)
  })

  it('does not make mosquitoes infectious before the incubation ends (cool day)', () => {
    const m = makeMosquitoes(1)
    m.em[12] = 4 // eipDays(20 C) is 13, so not ready yet
    mosquitoInfection(m, zeros(1), zeros(1).fill(5), 20, DEFAULT_PARAMS, createRng(1))
    expect(m.Im[0]).toBe(0)
    expect(m.em[13]).toBe(4)
  })

  it('with no infectious people, nobody new is exposed', () => {
    const m = makeMosquitoes(3)
    const sBefore = Array.from(m.Sm)
    const n = mosquitoInfection(m, zeros(3), zeros(3).fill(5), 28, DEFAULT_PARAMS, createRng(2))
    expect(n).toBe(0)
    expect(Array.from(m.Sm)).toEqual(sBefore)
    for (let h = 0; h < 3; h++) expect(m.em[h * EMAX]).toBe(0)
  })

  it('catches the virus at about the expected rate', () => {
    const m = makeMosquitoes(1)
    m.Sm[0] = 10000
    const inf = new Int32Array([5])
    const present = new Int32Array([5]) // everyone present is infectious
    const n = mosquitoInfection(m, inf, present, 28, DEFAULT_PARAMS, createRng(3))
    // p = 1 - exp(-0.3 * 0.5) = about 0.139, so about 1393 of 10000
    expect(n).toBeGreaterThan(1250)
    expect(n).toBeLessThan(1550)
    expect(m.em[0]).toBe(n) // returned count equals the new age-0 group
    expect(m.Sm[0]).toBe(10000 - n)
  })

  it('a household with nobody present gives no NaN and no infections', () => {
    const m = makeMosquitoes(1)
    const sBefore = m.Sm[0]
    const n = mosquitoInfection(m, zeros(1), zeros(1), 28, DEFAULT_PARAMS, createRng(4))
    expect(n).toBe(0)
    expect(m.Sm[0]).toBe(sBefore)
  })

  it('keeps the total number of mosquitoes constant and nothing negative', () => {
    const m = makeMosquitoes(50)
    const rng = createRng(5)
    for (let h = 0; h < 50; h++) {
      m.em[h * EMAX + (h % 15)] = 2
      m.Im[h] = h % 3
    }
    const inf = new Int32Array(50).map((_, h) => h % 4)
    const present = new Int32Array(50).fill(5)
    const before = totalMosquitoes(m)
    for (let day = 0; day < 30; day++) {
      mosquitoInfection(m, inf, present, 27, DEFAULT_PARAMS, rng)
      expect(totalMosquitoes(m)).toBe(before)
    }
    expect(Array.from(m.Sm).every((v) => v >= 0)).toBe(true)
    expect(Array.from(m.em).every((v) => v >= 0)).toBe(true)
    expect(Array.from(m.Im).every((v) => v >= 0)).toBe(true)
  })

  it('same seed gives the same result', () => {
    const run = (seed: number) => {
      const m = makeMosquitoes(20)
      const inf = new Int32Array(20).fill(2)
      const present = new Int32Array(20).fill(5)
      for (let day = 0; day < 10; day++) mosquitoInfection(m, inf, present, 28, DEFAULT_PARAMS, createRng(seed + day))
      return [Array.from(m.Sm), Array.from(m.em), Array.from(m.Im)]
    }
    expect(run(7)).toEqual(run(7))
  })
})