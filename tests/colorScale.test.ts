import { describe, expect, it } from 'vitest'
import { colorFor, DARKEST, LIGHTEST, sharedMax } from '../src/ui/map/colorScale'

describe('colorFor', () => {
  it('gives the lightest color for 0 and the darkest for the top value', () => {
    expect(colorFor(0, 10)).toBe('#fff5eb')
    expect(colorFor(10, 10)).toBe('#7f2704')
  })

  it('gives the middle color halfway', () => {
    expect(colorFor(5, 10)).toBe('#fd8d3c')
  })

  it('gives the darkest color above the top value', () => {
    expect(colorFor(25, 10)).toBe('#7f2704')
  })

  it('gives the lightest color for negative values, NaN and Infinity', () => {
    expect(colorFor(-3, 10)).toBe('#fff5eb')
    expect(colorFor(Number.NaN, 10)).toBe('#fff5eb')
    expect(colorFor(Number.POSITIVE_INFINITY, 10)).toBe('#fff5eb')
  })

  it('gives the lightest color when the top value is 0, negative or not a number', () => {
    expect(colorFor(4, 0)).toBe('#fff5eb')
    expect(colorFor(4, -1)).toBe('#fff5eb')
    expect(colorFor(4, Number.NaN)).toBe('#fff5eb')
  })

  it('always gives a six digit hex color', () => {
    for (const v of [0, 0.1, 1, 2.5, 3.3333, 7, 9.99, 10]) {
      expect(colorFor(v, 10)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('gets darker as the value goes up', () => {
    const red = (c: string) => parseInt(c.slice(1, 3), 16)
    const green = (c: string) => parseInt(c.slice(3, 5), 16)
    const light = colorFor(2, 10)
    const dark = colorFor(8, 10)
    expect(green(dark)).toBeLessThan(green(light))
    expect(red(dark)).toBeLessThanOrEqual(red(light))
  })

  it('exports the two ends for the legend', () => {
    expect(LIGHTEST).toBe('#fff5eb')
    expect(DARKEST).toBe('#7f2704')
  })
})

describe('sharedMax', () => {
  it('is the largest value over all the lists', () => {
    expect(sharedMax([1, 4, 2], [3, 9.5], [0])).toBe(9.5)
  })

  it('is 0 when there is nothing to count', () => {
    expect(sharedMax()).toBe(0)
    expect(sharedMax([], [])).toBe(0)
    expect(sharedMax([0, 0])).toBe(0)
  })

  it('ignores NaN, Infinity and negative values', () => {
    expect(sharedMax([Number.NaN, 3, Number.POSITIVE_INFINITY, -8])).toBe(3)
  })
})