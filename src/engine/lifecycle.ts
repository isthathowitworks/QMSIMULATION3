// Daily mosquito life-cycle steps, in the same order as the earlier Python engine.

import type { Mosquitoes } from './mosquitoes'
import { LMAX, EMAX } from './mosquitoes'
import { breedingCapacity, larvaSurvival } from './breeding'
import type { Rng } from './rng'

// Steps 1-2 (after the households have been picked): cleaning removes immatures and
// lowers the breeding-site level. `cleaning[h]` is 1 for a household that cleans today.
// Each immature survives with chance (1 - cleanKill); `site` is cut by cleanSiteCut.
export function applyCleaning(
  m: Mosquitoes,
  cleaning: ArrayLike<number>,
  rng: Rng,
  cleanKill = 0.7,
  cleanSiteCut = 0.5,
): void {
  for (let h = 0; h < m.households; h++) {
    if (!cleaning[h]) continue
    const row = h * LMAX
    for (let a = 0; a < LMAX; a++) {
      m.imm[row + a] = rng.binomial(m.imm[row + a], 1 - cleanKill)
    }
    m.site[h] *= 1 - cleanSiteCut
  }
}

// Step 3: immatures at age devDays or older become susceptible adults.
// Then everyone left gets one day older, and nothing new is at age 0 yet
// (the eggs laid today are added later in the day).
export function developAdults(m: Mosquitoes, devDays: number): void {
  for (let h = 0; h < m.households; h++) {
    const row = h * LMAX
    let emerged = 0
    for (let a = devDays; a < LMAX; a++) {
      emerged += m.imm[row + a]
      m.imm[row + a] = 0
    }
    m.Sm[h] += emerged
    for (let a = LMAX - 1; a >= 1; a--) {
      m.imm[row + a] = m.imm[row + a - 1]
    }
    m.imm[row] = 0
  }
}

// Step 4b: each adult (susceptible, exposed or infectious) dies with chance `mortality` today.
export function adultDeath(m: Mosquitoes, mortality: number, rng: Rng): void {
  for (let h = 0; h < m.households; h++) {
    m.Sm[h] -= rng.binomial(m.Sm[h], mortality)
    m.Im[h] -= rng.binomial(m.Im[h], mortality)
    const row = h * EMAX
    for (let d = 0; d < EMAX; d++) {
      const v = m.em[row + d]
      if (v > 0) m.em[row + d] = v - rng.binomial(v, mortality)
    }
  }
}

// Step 4e: adults lay eggs, crowding decides how many survive, and the survivors become
// the new age-0 immatures. Then cleaned breeding sites recover part of the way to full.
// `eggRatePerAdult` comes from eggRate(temperature) and `rainFactorToday` from rainFactor(rain14).
export function layEggs(
  m: Mosquitoes,
  householdSize: ArrayLike<number>,
  rng: Rng,
  eggRatePerAdult: number,
  rainFactorToday: number,
  kPerPerson = 2.4,
  larvaSurv0 = 0.9,
  siteRecovery = 0.1,
): void {
  for (let h = 0; h < m.households; h++) {
    let adults = m.Sm[h] + m.Im[h]
    const eRow = h * EMAX
    for (let d = 0; d < EMAX; d++) adults += m.em[eRow + d]

    const laid = rng.poisson(adults * eggRatePerAdult)

    let immatures = 0
    const iRow = h * LMAX
    for (let a = 0; a < LMAX; a++) immatures += m.imm[iRow + a]

    const capacity = breedingCapacity(householdSize[h], m.site[h], rainFactorToday, kPerPerson)
    const survival = larvaSurvival(immatures, capacity, larvaSurv0)
    m.imm[iRow] = rng.binomial(laid, survival)

    m.site[h] += siteRecovery * (1 - m.site[h])
  }
}