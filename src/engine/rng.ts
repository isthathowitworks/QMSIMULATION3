// Small seeded random number generator (mulberry32).
// The same seed always gives the same sequence, which the engine checks rely on.

export interface Rng {
  next(): number // uniform number from 0 up to (not including) 1
  int(n: number): number // whole number from 0 to n-1
  binomial(n: number, p: number): number // how many of n trials succeed, each with chance p
  poisson(lambda: number): number // count of events with average lambda
}

// Natural log of the gamma function (so logGamma(n + 1) is the log of n factorial).
// Shifts small values up to 7 or more, then uses the Stirling series.
export function logGamma(x: number): number {
  let shift = 0
  let z = x
  while (z < 7) {
    shift += Math.log(z)
    z += 1
  }
  const z2 = 1 / (z * z)
  const series = (1 / 12 - z2 * (1 / 360 - z2 * (1 / 1260 - z2 / 1680))) / z
  return (z - 0.5) * Math.log(z) - z + 0.9189385332046727 + series - shift
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // Standard normal number (Box-Muller). Used only for large binomial counts.
  const normal = (): number => {
    const u = 1 - next() // avoids log(0)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next())
  }

  // Exact below an expected count of 30 (inversion: one random number, no logs);
  // for larger ones (n * min(p, 1-p) of 30 or more) the normal approximation is used.
  const binomial = (n: number, p: number): number => {
    if (n <= 0 || p <= 0) return 0
    if (p >= 1) return n
    const q = p > 0.5 ? 1 - p : p
    let x: number
    if (n * q < 30) {
      const r = q / (1 - q)
      let f = Math.exp(n * Math.log1p(-q)) // chance of 0 successes
      let u = next()
      x = 0
      while (u > f) {
        u -= f
        x++
        if (x >= n) break
        f *= ((n - x + 1) / x) * r
      }
    } else {
      x = Math.round(n * q + Math.sqrt(n * q * (1 - q)) * normal())
      x = Math.min(n, Math.max(0, x))
    }
    return p > 0.5 ? n - x : x
  }

  // Exact for every average. Below 10: Knuth's method (about lambda draws).
  // From 10 up: the PTRS method (Hormann 1993, the one numpy uses), 2 to 3 draws on average.
  const poisson = (lambda: number): number => {
    if (lambda <= 0) return 0
    if (lambda < 10) {
      const limit = Math.exp(-lambda)
      let k = 0
      let prod = 1
      do {
        k++
        prod *= next()
      } while (prod > limit)
      return k - 1
    }
    const slam = Math.sqrt(lambda)
    const loglam = Math.log(lambda)
    const b = 0.931 + 2.53 * slam
    const aa = -0.059 + 0.02483 * b
    const invalpha = 1.1239 + 1.1328 / (b - 3.4)
    const vr = 0.9277 - 3.6224 / (b - 2)
    for (;;) {
      const u = next() - 0.5
      const v = next()
      const us = 0.5 - Math.abs(u)
      const k = Math.floor(((2 * aa) / us + b) * u + lambda + 0.43)
      if (us >= 0.07 && v <= vr) return k
      if (k < 0 || (us < 0.013 && v > us)) continue
      if (Math.log(v) + Math.log(invalpha) - Math.log(aa / (us * us) + b) <= -lambda + k * loglam - logGamma(k + 1)) {
        return k
      }
    }
  }

  return { next, int: (n: number) => Math.floor(next() * n), binomial, poisson }
}