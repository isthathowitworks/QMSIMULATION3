import { describe, expect, it } from 'vitest'
import { headlineFor } from '../src/state/headline'

describe('headlineFor', () => {
  it('says there is nothing to compare when the percentage is null', () => {
    const h = headlineFor(null)
    expect(h.kind).toBe('unknown')
    expect(h.big).toBe('n/a')
    expect(h.sentence).toContain('nothing to compare')
  })

  it('treats a value that is not a finite number as unknown', () => {
    expect(headlineFor(Number.NaN).kind).toBe('unknown')
    expect(headlineFor(Number.POSITIVE_INFINITY).kind).toBe('unknown')
  })

  it('shows a reduction as whole percent fewer infections', () => {
    const h = headlineFor((8 / 14) * 100)
    expect(h.kind).toBe('fewer')
    expect(h.big).toBe('57%')
    expect(h.sentence).toBe('fewer infections than doing nothing')
  })

  it('shows exactly 100 as 100%', () => {
    const h = headlineFor(100)
    expect(h.kind).toBe('fewer')
    expect(h.big).toBe('100%')
  })

  it('does not round 99.6 up to 100%', () => {
    expect(headlineFor(99.6).big).toBe('99%')
    expect(headlineFor(99.4).big).toBe('99%')
  })

  it('shows 0% and "no clear difference" when the change rounds to zero', () => {
    for (const value of [0, 0.4, -0.4]) {
      const h = headlineFor(value)
      expect(h.kind).toBe('same')
      expect(h.big).toBe('0%')
      expect(h.sentence).toContain('No clear difference')
    }
  })

  it('shows a worse policy as a positive number with the word more', () => {
    const h = headlineFor(-25)
    expect(h.kind).toBe('more')
    expect(h.big).toBe('25%')
    expect(h.sentence).toBe('more infections than doing nothing')
  })

  it('rounds a negative value to whole percent and allows more than 100%', () => {
    expect(headlineFor(-25.6).big).toBe('26%')
    expect(headlineFor(-250).big).toBe('250%')
  })
})