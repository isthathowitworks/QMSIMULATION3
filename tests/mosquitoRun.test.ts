import { describe, it, expect } from 'vitest'
import { runMosquitoes } from '../src/engine/mosquitoRun'
import { buildWeather } from '../src/engine/weather'
import { DEFAULT_PARAMS } from '../src/engine/params'
import type { World } from '../src/engine/population'

const H = 200
const DAYS = 200

function setup() {
  const world = { householdSize: new Uint8Array(H).fill(5) } as unknown as World
  const weather = buildWeather({
    start: '2019-01-01',
    days: DAYS,
    t2m: Array.from({ length: DAYS }, () => 28),
    rain: Array.from({ length: DAYS }, () => 7), // 98 mm over 14 days
  })
  return { world, weather }
}

function run(compliance: number, interval: number, seed: number) {
  const { world, weather } = setup()
  return runMosquitoes(
    world,
    weather,
    new Int32Array(H).fill(interval),
    new Float64Array(H).fill(compliance),
    DEFAULT_PARAMS,
    seed,
  )
}

function mean(a: Int32Array, from: number): number {
  let s = 0
  for (let i = from; i < a.length; i++) s += a[i]
  return s / (a.length - from)
}

describe('runMosquitoes', () => {
  it('gives one number per day for adults and cleanings', () => {
    const r = run(0.5, 7, 1)
    expect(r.adults.length).toBe(DAYS)
    expect(r.cleanings.length).toBe(DAYS)
  })

  it('never gives a negative count', () => {
    const r = run(0.5, 7, 2)
    for (const v of r.adults) expect(v).toBeGreaterThanOrEqual(0)
    for (const v of r.cleanings) expect(v).toBeGreaterThanOrEqual(0)
  })

  it('gives the same result for the same seed', () => {
    const a = run(0.5, 7, 3)
    const b = run(0.5, 7, 3)
    expect(Array.from(a.adults)).toEqual(Array.from(b.adults))
    expect(Array.from(a.cleanings)).toEqual(Array.from(b.cleanings))
  })

  it('with 0 compliance, nobody ever cleans', () => {
    const r = run(0, 7, 4)
    expect(r.cleanings.every((v) => v === 0)).toBe(true)
  })

  it('cleaning every household lowers the adult mosquitoes compared with no cleaning', () => {
    const none = run(0, 7, 5)
    const full = run(1, 7, 5)
    expect(mean(full.adults, 100)).toBeLessThan(mean(none.adults, 100))
  })
})