import { describe, it, expect } from 'vitest'
import { createRng } from '../src/engine/rng'

function stats(draw: () => number, count: number) {
  let sum = 0
  let sumSq = 0
  for (let i = 0; i < count; i++) {
    const x = draw()
    sum += x
    sumSq += x * x
  }
  const mean = sum / count
  return { mean, variance: sumSq / count - mean * mean }
}

describe('rng binomial and poisson', () => {
  it('binomial handles the edge cases', () => {
    const rng = createRng(1)
    expect(rng.binomial(0, 0.5)).toBe(0)
    expect(rng.binomial(10, 0)).toBe(0)
    expect(rng.binomial(10, 1)).toBe(10)
  })

  it('binomial gives whole numbers from 0 to n', () => {
    const rng = createRng(2)
    for (let i = 0; i < 5000; i++) {
      const x = rng.binomial(50, 0.37)
      expect(Number.isInteger(x)).toBe(true)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(50)
    }
  })

  it('binomial small case has the right mean and spread (n=20, p=0.3)', () => {
    const rng = createRng(3)
    const s = stats(() => rng.binomial(20, 0.3), 20000)
    expect(Math.abs(s.mean - 6)).toBeLessThan(0.1)
    expect(Math.abs(s.variance - 4.2)).toBeLessThan(0.3)
  })

  it('binomial large case has the right mean and spread (n=10000, p=0.4)', () => {
    const rng = createRng(4)
    const s = stats(() => rng.binomial(10000, 0.4), 5000)
    expect(Math.abs(s.mean - 4000)).toBeLessThan(5)
    expect(Math.abs(s.variance - 2400)).toBeLessThan(240)
  })

  it('binomial works when p is above 0.5 (n=20, p=0.9)', () => {
    const rng = createRng(5)
    const s = stats(() => rng.binomial(20, 0.9), 20000)
    expect(Math.abs(s.mean - 18)).toBeLessThan(0.1)
    expect(Math.abs(s.variance - 1.8)).toBeLessThan(0.2)
  })

  it('poisson gives 0 when lambda is 0 or below', () => {
    const rng = createRng(6)
    expect(rng.poisson(0)).toBe(0)
    expect(rng.poisson(-3)).toBe(0)
  })

  it('poisson small case has mean and spread near lambda (3)', () => {
    const rng = createRng(7)
    const s = stats(() => rng.poisson(3), 20000)
    expect(Math.abs(s.mean - 3)).toBeLessThan(0.1)
    expect(Math.abs(s.variance - 3)).toBeLessThan(0.3)
  })

  it('poisson large case has mean and spread near lambda (100)', () => {
    const rng = createRng(8)
    const s = stats(() => rng.poisson(100), 5000)
    expect(Math.abs(s.mean - 100)).toBeLessThan(1)
    expect(Math.abs(s.variance - 100)).toBeLessThan(10)
  })

  it('same seed gives the same binomial and poisson numbers', () => {
    const a = createRng(99)
    const b = createRng(99)
    for (let i = 0; i < 100; i++) {
      expect(a.binomial(40, 0.2)).toBe(b.binomial(40, 0.2))
      expect(a.poisson(7)).toBe(b.poisson(7))
    }
  })
})