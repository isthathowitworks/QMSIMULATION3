// Helpers for the settings fit. Pure functions: no file writing, no engine run, so tests and the CLI share them.

export interface FitSettings {
  biteRate: number
  kPerPerson: number
  reportFrac: number
  importedSurgeSize: number
}

/** Search ranges, from plan step 4.1 (same as the earlier Python fit). */
export const FIT_RANGES: Record<keyof FitSettings, [number, number]> = {
  biteRate: [0.1, 0.35],
  kPerPerson: [0.3, 3.0],
  reportFrac: [0.03, 0.4],
  importedSurgeSize: [0, 40],
}

export const FIT_KEYS = Object.keys(FIT_RANGES) as (keyof FitSettings)[]

/** Days in each simulated year, 2019 to 2025. Day 0 is 1 January 2019. */
export const YEAR_DAYS = [365, 366, 365, 365, 365, 366, 365]
export const WEEKS_PER_YEAR = 52

/** Small seeded random number generator (mulberry32). Returns numbers from 0 up to (not including) 1. */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Latin hypercube sample: n combinations. Each range is cut into n equal slices and every slice is used exactly once. */
export function latinHypercube(n: number, seed: number): FitSettings[] {
  const random = makeRandom(seed)
  const columns = FIT_KEYS.map((key) => {
    const order = Array.from({ length: n }, (_, i) => i)
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    const [lo, hi] = FIT_RANGES[key]
    return order.map((slice) => lo + ((slice + random()) / n) * (hi - lo))
  })
  return Array.from({ length: n }, (_, i) => {
    const s = {} as FitSettings
    FIT_KEYS.forEach((key, k) => { s[key] = columns[k][i] })
    return s
  })
}

/** Reported cases per week from a run. `onsets[day * municipalityCount + k]` is the new cases that day in municipality k.
 *  Result: 52 values per year for 2019 to 2025 (364 values), the first 364 days of each year, summed over all
 *  municipalities and multiplied by scale x reportFrac. */
export function weeklyReported(
  onsets: ArrayLike<number>,
  municipalityCount: number,
  scale: number,
  reportFrac: number,
): number[] {
  const out: number[] = []
  let yearStart = 0
  for (const yearDays of YEAR_DAYS) {
    for (let w = 0; w < WEEKS_PER_YEAR; w++) {
      let sum = 0
      for (let d = yearStart + w * 7; d < yearStart + w * 7 + 7; d++) {
        for (let k = 0; k < municipalityCount; k++) sum += onsets[d * municipalityCount + k] ?? 0
      }
      out.push(sum * scale * reportFrac)
    }
    yearStart += yearDays
  }
  return out
}

export interface FitScore {
  rmse: number
  mae: number
  correlation: number // NaN when it cannot be calculated (a flat series)
  totalReal: number
  totalSim: number
  score: number // lower is better
}

/** Compares simulated weekly cases with real ones. Weeks where `real` is null (no data) are ignored.
 *  score = RMSE x (2 - correlation), with a correlation that cannot be calculated counted as 0. */
export function scoreFit(real: (number | null)[], sim: number[]): FitScore {
  const r: number[] = []
  const s: number[] = []
  for (let i = 0; i < real.length; i++) {
    const v = real[i]
    if (v !== null) { r.push(v); s.push(sim[i]) }
  }
  const n = r.length
  if (n === 0) throw new Error('scoreFit: no weeks with real data')
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const mr = mean(r), ms = mean(s)
  let sse = 0, sae = 0, sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    const d = s[i] - r[i]
    sse += d * d
    sae += Math.abs(d)
    sxy += (r[i] - mr) * (s[i] - ms)
    sxx += (r[i] - mr) ** 2
    syy += (s[i] - ms) ** 2
  }
  const rmse = Math.sqrt(sse / n)
  const correlation = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN
  return {
    rmse,
    mae: sae / n,
    correlation,
    totalReal: r.reduce((x, y) => x + y, 0),
    totalSim: s.reduce((x, y) => x + y, 0),
    score: rmse * (2 - (Number.isNaN(correlation) ? 0 : correlation)),
  }
}