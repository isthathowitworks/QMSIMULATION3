import { describe, it, expect } from 'vitest'
import { createRng } from '../src/engine/rng'

describe('rng', () => {
  it('same seed gives the same sequence', () => {
    const a = createRng(42)
    const b = createRng(42)
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })

  it('different seeds give different sequences', () => {
    const a = createRng(1)
    const b = createRng(2)
    const same = Array.from({ length: 20 }, () => a.next() === b.next()).every(Boolean)
    expect(same).toBe(false)
  })

  it('next() stays in 0 up to (not including) 1', () => {
    const r = createRng(7)
    for (let i = 0; i < 10000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int(n) gives whole numbers from 0 to n-1', () => {
    const r = createRng(7)
    for (let i = 0; i < 10000; i++) {
      const v = r.int(10)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(10)
    }
  })

  it('average of many values is near 0.5', () => {
    const r = createRng(99)
    let sum = 0
    for (let i = 0; i < 100000; i++) sum += r.next()
    expect(sum / 100000).toBeGreaterThan(0.49)
    expect(sum / 100000).toBeLessThan(0.51)
  })
})