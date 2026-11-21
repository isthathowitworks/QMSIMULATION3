import { describe, it, expect } from 'vitest'
import { buildWorld } from '../src/engine/population'
import type { PopulationFile } from '../src/engine/population'
import { createMosquitoes, LMAX } from '../src/engine/mosquitoes'
import { applyCleaning, developAdults } from '../src/engine/lifecycle'
import { createRng } from '../src/engine/rng'

// Same tiny made-up world as before: households of 5, 5, 4 and 6 people.
const file: PopulationFile = {
  peoplePerSimPerson: 10,
  peoplePerHousehold: 5,
  barangays: [
    { municipality: 'A', barangay: 'One', population: 140, simPeople: 14, households: 3 },
    { municipality: 'A', barangay: 'Two', population: 60, simPeople: 6, households: 1 },
  ],
}

const fresh = () => createMosquitoes(buildWorld(file))
const row = (imm: Int32Array, h: number) => Array.from(imm.slice(h * LMAX, (h + 1) * LMAX))
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

describe('applyCleaning', () => {
  it('removes about 70% of immatures at every age in a cleaning household', () => {
    const m = fresh()
    m.imm[0 * LMAX + 0] = 1000
    m.imm[0 * LMAX + 24] = 1000
    applyCleaning(m, new Uint8Array([1, 0, 0, 0]), createRng(1))
    expect(m.imm[0]).toBeGreaterThan(240)
    expect(m.imm[0]).toBeLessThan(360)
    expect(m.imm[24]).toBeGreaterThan(240)
    expect(m.imm[24]).toBeLessThan(360)
  })

  it('leaves households that do not clean untouched', () => {
    const m = fresh()
    m.imm[1 * LMAX + 3] = 50
    applyCleaning(m, new Uint8Array([1, 0, 0, 0]), createRng(2))
    expect(m.imm[1 * LMAX + 3]).toBe(50)
    expect(m.site[1]).toBe(1)
    expect(m.site[2]).toBe(1)
  })

  it('cleanKill of 1 removes everything and 0 removes nothing', () => {
    const a = fresh()
    a.imm[3] = 40
    applyCleaning(a, new Uint8Array([1, 1, 1, 1]), createRng(3), 1)
    expect(sum(row(a.imm, 0))).toBe(0)

    const b = fresh()
    b.imm[3] = 40
    applyCleaning(b, new Uint8Array([1, 1, 1, 1]), createRng(3), 0)
    expect(b.imm[3]).toBe(40)
  })

  it('cuts the breeding-site level by half each time a household cleans', () => {
    const m = fresh()
    const clean = new Uint8Array([1, 0, 0, 0])
    applyCleaning(m, clean, createRng(4))
    expect(m.site[0]).toBe(0.5)
    applyCleaning(m, clean, createRng(4))
    expect(m.site[0]).toBe(0.25)
    expect(m.site[1]).toBe(1)
  })
})

describe('developAdults', () => {
  it('turns immatures at devDays or older into adults and ages the rest by a day', () => {
    const m = fresh()
    m.imm[0 * LMAX + 5] = 10
    m.imm[0 * LMAX + 9] = 20
    m.imm[0 * LMAX + 10] = 30
    m.imm[0 * LMAX + 24] = 4
    developAdults(m, 10)
    expect(m.Sm[0]).toBe(8 + 30 + 4)
    const r = row(m.imm, 0)
    expect(r[6]).toBe(10)
    expect(r[10]).toBe(20)
    expect(sum(r)).toBe(30)
  })

  it('does not lose or create mosquitoes', () => {
    const m = fresh()
    for (let a = 0; a < LMAX; a++) m.imm[0 * LMAX + a] = a + 1
    const before = sum(row(m.imm, 0)) + m.Sm[0]
    developAdults(m, 12)
    expect(sum(row(m.imm, 0)) + m.Sm[0]).toBe(before)
  })

  it('leaves other households alone apart from ageing, and empties age 0', () => {
    const m = fresh()
    m.imm[1 * LMAX + 2] = 7
    m.imm[1 * LMAX + 0] = 3
    developAdults(m, 10)
    const r = row(m.imm, 1)
    expect(m.Sm[1]).toBe(8)
    expect(r[0]).toBe(0)
    expect(r[1]).toBe(3)
    expect(r[3]).toBe(7)
    expect(r[2]).toBe(0)
  })

  it('with devDays of 20, ages 20 to 24 all emerge', () => {
    const m = fresh()
    for (let a = 20; a < LMAX; a++) m.imm[0 * LMAX + a] = 1
    developAdults(m, 20)
    expect(m.Sm[0]).toBe(8 + 5)
    expect(sum(row(m.imm, 0))).toBe(0)
  })
})