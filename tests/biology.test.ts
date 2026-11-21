import { describe, it, expect } from 'vitest'
import { devDays, eipDays, adultMortality, eggRate } from '../src/engine/biology'

describe('devDays (egg to adult)', () => {
  it('is 9 days at 29 C and warmer', () => {
    expect(devDays(29)).toBe(9)
    expect(devDays(34)).toBe(9)
  })
  it('is longer when cooler, but never above 20', () => {
    expect(devDays(20)).toBe(16)
    expect(devDays(10)).toBe(20)
  })
})

describe('eipDays (virus incubation in the mosquito)', () => {
  it('is 10 days at 28 C', () => {
    expect(eipDays(28)).toBe(10)
  })
  it('is shorter when hotter and longer when cooler, within 5 to 15', () => {
    expect(eipDays(32)).toBe(8)
    expect(eipDays(20)).toBe(13)
    expect(eipDays(40)).toBe(5)
    expect(eipDays(10)).toBe(15)
  })
  it('rounds .5 to the even number, like the old Python engine', () => {
    expect(eipDays(26.75)).toBe(10) // 10.5 -> 10
    expect(eipDays(29.25)).toBe(10) // 9.5 -> 10
  })
})

describe('adultMortality (daily death chance)', () => {
  it('is lowest, 0.06, at 27 C', () => {
    expect(adultMortality(27)).toBeCloseTo(0.06, 10)
  })
  it('rises away from 27 C but never above 0.5', () => {
    expect(adultMortality(37)).toBeCloseTo(0.31, 10)
    expect(adultMortality(5)).toBe(0.5)
  })
})

describe('eggRate (eggs per adult per day)', () => {
  it('is highest, 0.8, at 29 C', () => {
    expect(eggRate(29)).toBeCloseTo(0.8, 10)
  })
  it('is zero outside 18 to 36 C', () => {
    expect(eggRate(17.9)).toBe(0)
    expect(eggRate(36.1)).toBe(0)
  })
  it('follows the curve in between', () => {
    expect(eggRate(23.5)).toBeCloseTo(0.6, 10)
  })
  it('uses a different maximum when given one', () => {
    expect(eggRate(29, 0.4)).toBeCloseTo(0.4, 10)
  })
})