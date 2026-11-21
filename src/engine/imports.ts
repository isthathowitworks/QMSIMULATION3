// 2.5c: infections brought in from outside the province.
// Background imports every day, plus an extra surge in weeks 30 to 44 of 2019 only
// (the 2019 epidemic wave). The surge can be switched off with params.importSurgeOn.

import type { World } from './population'
import { SUSCEPTIBLE } from './population'
import type { Rng } from './rng'
import type { Params } from './params'

const SURGE_FIRST_WEEK = 30
const SURGE_LAST_WEEK = 44
const DAYS_IN_FIRST_YEAR = 364 // 52 weeks; the surge only exists in 2019

// Imported infections per day per 100,000 people on a given day.
// `day` 0 is 1 January 2019. Negative days (warm-up) get the background rate.
export function importRatePer100k(day: number, params: Params): number {
  let rate = params.importPerDayPer100k
  if (params.importSurgeOn && day >= 0 && day < DAYS_IN_FIRST_YEAR) {
    const week = Math.floor(day / 7) + 1
    if (week >= SURGE_FIRST_WEEK && week <= SURGE_LAST_WEEK) rate += params.importedSurgeSize
  }
  return rate
}

// Picks susceptible people at random and marks them infected today (newE[p] = 1).
// People already marked in newE (infected by a mosquito today) are skipped.
// The count is Poisson with mean rate x people x scale / 100,000.
// Returns how many people were newly marked.
export function importInfections(
  world: World,
  newE: Uint8Array,
  day: number,
  params: Params,
  rng: Rng,
): number {
  const n = world.personState.length
  const lambda = (importRatePer100k(day, params) * n * params.scale) / 1e5
  const wanted = lambda > 0 ? rng.poisson(lambda) : 0
  if (wanted === 0) return 0

  const candidates = new Int32Array(n)
  let count = 0
  for (let p = 0; p < n; p++) {
    if (world.personState[p] === SUSCEPTIBLE && !newE[p]) candidates[count++] = p
  }
  const k = Math.min(wanted, count)
  for (let i = 0; i < k; i++) {
    const j = i + rng.int(count - i)
    const tmp = candidates[i]
    candidates[i] = candidates[j]
    candidates[j] = tmp
    newE[candidates[i]] = 1
  }
  return k
}