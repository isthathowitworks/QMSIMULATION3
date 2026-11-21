// Infection steps, in the same order as the earlier Python engine.
// This file holds 2.5a (mosquito side, step 4c). The human side (4d and 5) is added later.

import type { Mosquitoes } from './mosquitoes'
import { EMAX } from './mosquitoes'
import type { Rng } from './rng'
import type { Params } from './params'
import { eipDays } from './biology'

// Step 4c: exposed mosquitoes finish incubation, then susceptible mosquitoes bite infectious people.
//   1. Exposed mosquitoes that have waited eipDays(temperature) or longer become infectious.
//   2. Every mosquito still exposed gets one day older.
//   3. Each susceptible mosquito catches the virus with chance
//      1 - exp(-biteRate * pH2m * infectiousPresent / present).
//      The newly exposed go into column 0 (age 0 days).
// `infectiousPresent[h]` and `present[h]` count the PEOPLE in household h today
// (infectious people, and all people). Movement (2.6) supplies them.
// Returns how many mosquitoes were newly exposed today.
export function mosquitoInfection(
  m: Mosquitoes,
  infectiousPresent: ArrayLike<number>,
  present: ArrayLike<number>,
  tempC: number,
  params: Params,
  rng: Rng,
): number {
  const eip = eipDays(tempC)
  const rate = params.biteRate * params.pH2m
  let newlyExposed = 0

  for (let h = 0; h < m.households; h++) {
    const row = h * EMAX

    // 1. finished incubation: becomes infectious
    let ready = 0
    for (let d = eip; d < EMAX; d++) {
      ready += m.em[row + d]
      m.em[row + d] = 0
    }
    m.Im[h] += ready

    // 2. everyone still exposed gets one day older
    for (let d = EMAX - 1; d >= 1; d--) {
      m.em[row + d] = m.em[row + d - 1]
    }
    m.em[row] = 0

    // 3. susceptible mosquitoes pick up the virus from infectious people present
    const people = Math.max(present[h], 1)
    const pInfect = 1 - Math.exp((-rate * infectiousPresent[h]) / people)
    const caught = rng.binomial(m.Sm[h], pInfect)
    m.Sm[h] -= caught
    m.em[row] = caught
    newlyExposed += caught
  }

  return newlyExposed
}