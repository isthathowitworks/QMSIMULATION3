import { describe, it, expect } from 'vitest'
import { createRng } from '../src/engine/rng'

const N = 40000

describe('binomial (inversion)', () => {
  it.each([
    [10, 0.3],
    [29, 0.3],
    [36, 0.1],
    [1000, 0.01],
    [20, 0.9],
    [5, 0.5],
    [1, 0.4],
  ])('has mean and variance close to the theory for n = %i, p = %d', (n, p) => {
    const rng = createRng(n * 7 + 1)
    let sum = 0
    let sumSq = 0
    for (let i = 0; i < N; i++) {
      const x = rng.binomial(n, p)
      sum += x
      sumSq += x * x
    }
    const mean = sum / N
    const variance = sumSq / N - mean * mean
    const theoryVar = n * p * (1 - p)
    expect(Math.abs(mean - n * p)).toBeLessThan(4 * Math.sqrt(theoryVar / N))
    expect(variance / theoryVar).toBeGreaterThan(0.93)
    expect(variance / theoryVar).toBeLessThan(1.07)
  })

  it('gives the exact chances for n = 10, p = 0.3 (P(0) = 0.0282, P(3) = 0.2668)', () => {
    const rng = createRng(42)
    let zero = 0
    let three = 0
    for (let i = 0; i < N; i++) {
      const x = rng.binomial(10, 0.3)
      if (x === 0) zero++
      if (x === 3) three++
    }
    expect(Math.abs(zero / N - 0.0282)).toBeLessThan(0.005)
    expect(Math.abs(three / N - 0.2668)).toBeLessThan(0.01)
  })

  it('never gives a number outside 0 to n, and always a whole number', () => {
    const rng = createRng(8)
    for (const [n, p] of [[1, 0.5], [3, 0.5], [3, 0.99], [40, 0.45], [500, 0.05]]) {
      for (let i = 0; i < 5000; i++) {
        const x = rng.binomial(n, p)
        expect(Number.isInteger(x)).toBe(true)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(n)
      }
    }
  })
})