// One simulated day for the mosquitoes, in the same order as the earlier Python engine.
// mosquitoDay runs the mosquito-only day. The full run (run.ts) calls the two halves
// itself, with fogging, movement and infection in between.

import type { Mosquitoes } from './mosquitoes'
import type { Rng } from './rng'
import type { Params } from './params'
import { pickCleaning } from './schedule'
import { applyCleaning, developAdults, adultDeath, layEggs } from './lifecycle'
import { devDays, adultMortality, eggRate } from './biology'
import { rainFactor } from './breeding'

// Cleaning schedule, one entry per household. `out` is reused every day.
export interface CleaningPlan {
  intervals: ArrayLike<number> // days between cleanings; 0 or less means never
  offsets: ArrayLike<number> // from makeCleaningOffsets
  compliance: ArrayLike<number> // chance a due household actually cleans
  out: Uint8Array // 1 if the household cleans today
}

// First half of the day: steps 1-2 (who cleans, cleaning) and step 3 (development).
// `day` may be negative (spin-up). Returns how many households cleaned.
export function dayStart(
  m: Mosquitoes,
  plan: CleaningPlan,
  day: number,
  tempC: number,
  params: Params,
  rng: Rng,
): number {
  const cleaned = pickCleaning(day, plan.intervals, plan.offsets, plan.compliance, rng, plan.out)
  if (cleaned > 0) applyCleaning(m, plan.out, rng, params.cleanKill, params.cleanSiteCut)
  developAdults(m, devDays(tempC))
  return cleaned
}

// Step 4b: adult death.
export function dayAdultDeath(m: Mosquitoes, tempC: number, rng: Rng): void {
  adultDeath(m, adultMortality(tempC), rng)
}

// Step 4e: egg laying with crowding.
export function dayEggs(
  m: Mosquitoes,
  householdSize: ArrayLike<number>,
  tempC: number,
  rain14: number,
  params: Params,
  rng: Rng,
): void {
  layEggs(
    m,
    householdSize,
    rng,
    eggRate(tempC, params.eggRateMax),
    rainFactor(rain14, params.rainBase, params.rainSatMm),
    params.kPerPerson,
    params.larvaSurv0,
    params.siteRecovery,
  )
}

// Runs one mosquito-only day. Returns how many households cleaned.
export function mosquitoDay(
  m: Mosquitoes,
  householdSize: ArrayLike<number>,
  plan: CleaningPlan,
  day: number,
  tempC: number,
  rain14: number,
  params: Params,
  rng: Rng,
): number {
  const cleaned = dayStart(m, plan, day, tempC, params, rng)
  dayAdultDeath(m, tempC, rng)
  dayEggs(m, householdSize, tempC, rain14, params, rng)
  return cleaned
}