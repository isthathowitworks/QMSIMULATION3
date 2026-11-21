import { describe, it, expect } from 'vitest'
import { rolling14, rainFactor, breedingCapacity, larvaSurvival } from '../src/engine/breeding'

describe('rolling14 (rain over the last 14 days)', () => {
  it('adds up fewer days at the start of the record', () => {
    const r = rolling14(new Array(20).fill(1))
    expect(r[0]).toBe(1)
    expect(r[4]).toBe(5)
    expect(r[13]).toBe(14)
  })
  it('keeps a 14-day window after that', () => {
    const r = rolling14(new Array(20).fill(1))
    expect(r[14]).toBe(14)
    expect(r[19]).toBe(14)
  })
  it('drops a rainy day after 14 days', () => {
    const rain = new Array(20).fill(0)
    rain[0] = 10
    const r = rolling14(rain)
    expect(r[13]).toBe(10)
    expect(r[14]).toBe(0)
  })
})

describe('rainFactor (how full the breeding sites are)', () => {
  it('is 0.3 in a dry spell', () => {
    expect(rainFactor(0)).toBeCloseTo(0.3, 10)
  })
  it('is 1 at 100 mm of rain over 14 days', () => {
    expect(rainFactor(100)).toBeCloseTo(1, 10)
  })
  it('rises in between', () => {
    expect(rainFactor(50)).toBeCloseTo(0.65, 10)
  })
  it('stops rising at 1.5 times full (1.35)', () => {
    expect(rainFactor(150)).toBeCloseTo(1.35, 10)
    expect(rainFactor(500)).toBeCloseTo(1.35, 10)
  })
})

describe('breedingCapacity (most larvae a household can hold)', () => {
  it('is 2.4 per person when sites are full and rain factor is 1', () => {
    expect(breedingCapacity(5, 1, 1)).toBeCloseTo(12, 10)
  })
  it('shrinks with fewer sites or less rain', () => {
    expect(breedingCapacity(5, 1, 0.5)).toBeCloseTo(6, 10)
    expect(breedingCapacity(4, 0.25, 0.3)).toBeCloseTo(0.72, 10)
  })
})

describe('larvaSurvival (share of new eggs that survive)', () => {
  it('is 0.9 when there are no larvae yet', () => {
    expect(larvaSurvival(0, 10)).toBeCloseTo(0.9, 10)
  })
  it('falls as the household fills up', () => {
    expect(larvaSurvival(10, 10)).toBeCloseTo(0.45, 10)
    expect(larvaSurvival(50, 12)).toBeCloseTo(0.174193548, 8)
  })
  it('is almost 0 when the household can hold nothing', () => {
    expect(larvaSurvival(5, 0)).toBeCloseTo(0, 8)
  })
})