import { describe, it, expect } from 'vitest'
import { createRng, logGamma } from '../src/engine/rng'

const N = 40000

describe('logGamma', () => {
  it('matches known factorials', () => {
    expect(logGamma(1)).toBeCloseTo(0, 8)
    expect(logGamma(2)).toBeCloseTo(0, 8)
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 8)
    expect(logGamma(11)).toBeCloseTo(Math.log(3628800), 8)
    expect(logGamma(51)).toBeCloseTo(Math.log(3.0414093201713376e64), 8)
  })
})

describe('poisson', () => {
  it.each([12, 28, 60, 200])('has mean and variance close to lambda = %i', (lambda) => {
    const rng = createRng(lambda)
    let sum = 0
    let sumSq = 0
    for (let i = 0; i < N; i++) {
      const x = rng.poisson(lambda)
      sum += x
      sumSq += x * x
    }
    const mean = sum / N
    const variance = sumSq / N - mean * mean
    expect(Math.abs(mean - lambda)).toBeLessThan(4 * Math.sqrt(lambda / N))
    expect(variance / lambda).toBeGreaterThan(0.95)
    expect(variance / lambda).toBeLessThan(1.05)
  })

  it('gives the right share of small counts for lambda = 12 (P(X <= 8) is about 0.155)', () => {
    const rng = createRng(99)
    let low = 0
    for (let i = 0; i < N; i++) if (rng.poisson(12) <= 8) low++
    expect(Math.abs(low / N - 0.155)).toBeLessThan(0.01)
  })

  it('always gives whole numbers that are not negative', () => {
    const rng = createRng(5)
    for (const lambda of [0.5, 9.9, 10, 10.1, 30, 45, 500]) {
      for (let i = 0; i < 2000; i++) {
        const x = rng.poisson(lambda)
        expect(Number.isInteger(x)).toBe(true)
        expect(x).toBeGreaterThanOrEqual(0)
      }
    }
  })
})