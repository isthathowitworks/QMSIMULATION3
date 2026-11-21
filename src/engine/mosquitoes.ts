// The mosquitoes in every household, stored in flat typed arrays.
// Layout and starting numbers copied from the earlier Python engine.

import { roundHalfEven } from './biology'
import type { World } from './population'

export const LMAX = 25 // columns for immature age in days (0 to 24)
export const EMAX = 20 // columns for days since an adult caught the virus (0 to 19)

export interface Mosquitoes {
  households: number
  imm: Int32Array // immatures: row h starts at h * LMAX, one column per day of age
  Sm: Int32Array // susceptible adults, one per household
  em: Int32Array // exposed adults: row h starts at h * EMAX, one column per day since infection
  Im: Int32Array // infectious adults, one per household
  site: Float64Array // breeding-site level, 1 = untouched, cleaning lowers it
}

// Starting state: no immatures, no infected mosquitoes, breeding sites at full level,
// and round(household size x adultsPerPerson) susceptible adults in each household.
export function createMosquitoes(world: World, adultsPerPerson = 1.5): Mosquitoes {
  const households = world.householdSize.length
  const Sm = new Int32Array(households)
  for (let h = 0; h < households; h++) {
    Sm[h] = roundHalfEven(world.householdSize[h] * adultsPerPerson)
  }
  return {
    households,
    imm: new Int32Array(households * LMAX),
    Sm,
    em: new Int32Array(households * EMAX),
    Im: new Int32Array(households),
    site: new Float64Array(households).fill(1),
  }
}