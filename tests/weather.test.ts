import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildWeather } from '../src/engine/weather'
import type { WeatherFile } from '../src/engine/weather'

function small(): WeatherFile {
  // 16 days: rain is 1, 2, 3, ... 16
  return {
    start: '2019-01-01',
    days: 16,
    t2m: Array.from({ length: 16 }, () => 28),
    rain: Array.from({ length: 16 }, (_, i) => i + 1),
  }
}

describe('buildWeather', () => {
  it('keeps the start date and the number of days', () => {
    const w = buildWeather(small())
    expect(w.start).toBe('2019-01-01')
    expect(w.days).toBe(16)
    expect(w.t2m.length).toBe(16)
    expect(w.rain.length).toBe(16)
    expect(w.rain14.length).toBe(16)
  })

  it('sums only the days that exist at the start of the record', () => {
    const w = buildWeather(small())
    expect(w.rain14[0]).toBe(1)
    expect(w.rain14[2]).toBe(6) // 1 + 2 + 3
  })

  it('uses a full 14-day window once there are 14 days', () => {
    const w = buildWeather(small())
    expect(w.rain14[13]).toBe(105) // 1 + ... + 14
    expect(w.rain14[14]).toBe(119) // day 0 drops out, day 14 comes in: 105 - 1 + 15
    expect(w.rain14[15]).toBe(133) // 119 - 2 + 16
  })

  it('throws when the day count does not match the lists', () => {
    const bad = small()
    bad.days = 20
    expect(() => buildWeather(bad)).toThrow()
  })

  it('works on the real weather.json', () => {
    const file = JSON.parse(
      readFileSync(resolve(process.cwd(), 'public/data/weather.json'), 'utf-8'),
    ) as WeatherFile
    const w = buildWeather(file)
    expect(w.days).toBe(2557)
    expect(w.rain14.length).toBe(2557)
    for (const v of w.rain14) expect(v).toBeGreaterThanOrEqual(0)
  })
})