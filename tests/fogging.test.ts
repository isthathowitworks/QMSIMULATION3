import { describe, it, expect } from 'vitest'
import { createRng } from '../src/engine/rng'
import { createMosquitoes, EMAX } from '../src/engine/mosquitoes'
import type { World } from '../src/engine/population'
import { DEFAULT_PARAMS } from '../src/engine/params'
import type { Params } from '../src/engine/params'
import { applyFogging, createFogState } from '../src/engine/fogging'

const H = 200 // households 0-99 in municipality 0, 100-199 in municipality 1
const M = 2

function setup() {
  const world = { householdSize: new Uint8Array(H).fill(5) } as unknown as World
  const mosq = createMosquitoes(world)
  const muni = new Uint8Array(H)
  for (let h = 100; h < H; h++) muni[h] = 1
  return { mosq, muni, fog: createFogState(M), rng: createRng(1) }
}
type Setup = ReturnType<typeof setup>

// one row per day, one column per municipality
function table(rows: number[][]): Int32Array {
  return Int32Array.from(rows.flat())
}

function fogOnce(
  s: Setup,
  onsets: Int32Array,
  daysRecorded: number,
  day: number,
  params: Partial<Params> = {},
  trigger: number[] = [1, 1],
) {
  const p = { ...DEFAULT_PARAMS, fogCoverage: 1, fogKill: 1, ...params }
  applyFogging(s.mosq, s.muni, M, trigger, onsets, daysRecorded, day, s.fog, p, s.rng)
}

function sumSm(s: Setup, from: number, to: number): number {
  let n = 0
  for (let h = from; h < to; h++) n += s.mosq.Sm[h]
  return n
}

describe('applyFogging', () => {
  it('does nothing before any day is recorded', () => {
    const s = setup()
    const before = sumSm(s, 0, H)
    fogOnce(s, table([]), 0, 5)
    expect(sumSm(s, 0, H)).toBe(before)
    expect(s.fog.events[0]).toBe(0)
  })

  it('does nothing when there are no cases', () => {
    const s = setup()
    const before = sumSm(s, 0, H)
    fogOnce(s, table([[0, 0]]), 1, 5)
    expect(sumSm(s, 0, H)).toBe(before)
    expect(Array.from(s.fog.events)).toEqual([0, 0])
  })

  it('fogs the municipality that reaches its trigger and leaves the other alone', () => {
    const s = setup()
    const otherBefore = sumSm(s, 100, H)
    fogOnce(s, table([[4, 0]]), 1, 5) // 4 x 10 x 0.25 = 10 reported cases
    expect(sumSm(s, 0, 100)).toBe(0)
    expect(sumSm(s, 100, H)).toBe(otherBefore)
    expect(Array.from(s.fog.events)).toEqual([1, 0])
  })

  it('does not fog below the trigger', () => {
    const s = setup()
    const before = sumSm(s, 0, H)
    fogOnce(s, table([[1, 0]]), 1, 5, {}, [5, 5]) // 2.5 reported cases, trigger 5
    expect(sumSm(s, 0, H)).toBe(before)
    expect(s.fog.events[0]).toBe(0)
  })

  it('counts only the last 7 recorded days', () => {
    const rows = [[100, 0], ...Array.from({ length: 9 }, () => [0, 0])] // cases on day 0 only
    const a = setup()
    fogOnce(a, table(rows), 7, 20) // days 0 to 6 still include day 0
    expect(a.fog.events[0]).toBe(1)
    const b = setup()
    fogOnce(b, table(rows), 8, 20) // days 1 to 7: day 0 has dropped out
    expect(b.fog.events[0]).toBe(0)
  })

  it('waits the cooldown before fogging the same municipality again', () => {
    const s = setup()
    const t = table([[4, 0]])
    fogOnce(s, t, 1, 10)
    expect(s.fog.events[0]).toBe(1)
    fogOnce(s, t, 1, 16) // only 6 days later
    expect(s.fog.events[0]).toBe(1)
    fogOnce(s, t, 1, 17) // 7 days later
    expect(s.fog.events[0]).toBe(2)
  })

  it('with coverage 0, fogging is off', () => {
    const s = setup()
    const before = sumSm(s, 0, H)
    fogOnce(s, table([[4, 4]]), 1, 5, { fogCoverage: 0 })
    expect(sumSm(s, 0, H)).toBe(before)
    expect(Array.from(s.fog.events)).toEqual([0, 0])
  })

  it('reaches about the coverage share of households', () => {
    const s = setup()
    fogOnce(s, table([[4, 0]]), 1, 5, { fogCoverage: 0.6 })
    let hit = 0
    for (let h = 0; h < 100; h++) if (s.mosq.Sm[h] === 0) hit++
    expect(hit).toBeGreaterThan(45)
    expect(hit).toBeLessThan(75)
  })

  it('kills about the fogKill share of adults in a fogged household', () => {
    const s = setup()
    const before = sumSm(s, 0, 100)
    fogOnce(s, table([[4, 0]]), 1, 5, { fogKill: 0.5 })
    const after = sumSm(s, 0, 100)
    expect(after).toBeGreaterThan(before * 0.425)
    expect(after).toBeLessThan(before * 0.575)
  })

  it('also kills infectious and exposed adults', () => {
    const s = setup()
    for (let h = 0; h < H; h++) {
      s.mosq.Im[h] = 10
      s.mosq.em[h * EMAX + 3] = 10
    }
    fogOnce(s, table([[4, 0]]), 1, 5)
    for (let h = 0; h < 100; h++) {
      expect(s.mosq.Im[h]).toBe(0)
      expect(s.mosq.em[h * EMAX + 3]).toBe(0)
    }
    for (let h = 100; h < H; h++) {
      expect(s.mosq.Im[h]).toBe(10)
      expect(s.mosq.em[h * EMAX + 3]).toBe(10)
    }
  })
})