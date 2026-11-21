// Infection steps for people, in the same order as the earlier Python engine.
// 2.5b: step 4d (mosquitoes infect people), step 5 (E -> I -> R, yearly return of immunity)
// and the seeding of the first infectious people.
// Imports (2.5c) and movement (2.6) are added later.

import type { World } from './population'
import { SUSCEPTIBLE, EXPOSED, INFECTIOUS, RECOVERED } from './population'
import type { Rng } from './rng'
import type { Params } from './params'

// Days left in the exposed or infectious state, one entry per person.
export function createTimers(world: World): Uint8Array {
  return new Uint8Array(world.personState.length)
}

// Each person starts recovered with chance `initialImmune`.
export function applyInitialImmune(world: World, initialImmune: number, rng: Rng): void {
  if (initialImmune <= 0) return
  for (let p = 0; p < world.personState.length; p++) {
    if (rng.next() < initialImmune) world.personState[p] = RECOVERED
  }
}

// Makes `seedInfected` randomly chosen susceptible people infectious.
// Each gets 1 to infectiousDays days left. Returns how many were seeded.
export function seedInfection(world: World, timer: Uint8Array, params: Params, rng: Rng): number {
  const n = world.personState.length
  const candidates = new Int32Array(n)
  let count = 0
  for (let p = 0; p < n; p++) {
    if (world.personState[p] === SUSCEPTIBLE) candidates[count++] = p
  }
  const k = Math.min(params.seedInfected, count)
  for (let i = 0; i < k; i++) {
    const j = i + rng.int(count - i)
    const tmp = candidates[i]
    candidates[i] = candidates[j]
    candidates[j] = tmp
    const p = candidates[i]
    world.personState[p] = INFECTIOUS
    timer[p] = 1 + rng.int(params.infectiousDays)
  }
  return k
}

// Step 4d: infectious mosquitoes infect susceptible people.
//   loc[p]      household where person p is today (movement, 2.6, supplies this)
//   present[h]  people in household h today
//   Im[h]       infectious mosquitoes in household h (after step 4c)
// Fills `newE` (1 = infected today, 0 = not) for every person and returns how many.
// `pInfect` is scratch space with one entry per household.
export function infectPeople(
  world: World,
  loc: ArrayLike<number>,
  present: ArrayLike<number>,
  Im: ArrayLike<number>,
  params: Params,
  rng: Rng,
  newE: Uint8Array,
  pInfect: Float64Array,
): number {
  const households = world.householdSize.length
  const rate = params.biteRate * params.pM2h
  for (let h = 0; h < households; h++) {
    pInfect[h] = 1 - Math.exp((-rate * Im[h]) / Math.max(present[h], 1))
  }
  let count = 0
  const n = world.personState.length
  for (let p = 0; p < n; p++) {
    const q = pInfect[loc[p]]
    if (world.personState[p] === SUSCEPTIBLE && q > 0 && rng.next() < q) {
      newE[p] = 1
      count++
    } else {
      newE[p] = 0
    }
  }
  return count
}

// Step 5: move people along E -> I -> R, add today's new infections (newE), and let a few
// recovered people return to susceptible (births and deaths).
// `onsets` has one entry per municipality; it is reset here and then counts people who
// became infectious today (the day a case shows up). Returns how many people were newly infected.
export function updateHumans(
  world: World,
  timer: Uint8Array,
  newE: Uint8Array,
  params: Params,
  rng: Rng,
  onsets: Int32Array,
): number {
  onsets.fill(0)
  const state = world.personState
  const turnover = params.popTurnoverPerYear / 365
  let newInfections = 0

  for (let p = 0; p < state.length; p++) {
    const s = state[p]
    if (s === EXPOSED || s === INFECTIOUS) {
      timer[p] -= 1
      if (timer[p] <= 0) {
        if (s === EXPOSED) {
          state[p] = INFECTIOUS
          timer[p] = params.infectiousDays
          onsets[world.householdMunicipality[world.personHousehold[p]]] += 1
        } else {
          state[p] = RECOVERED
        }
      }
    }
    if (newE[p]) {
      state[p] = EXPOSED
      timer[p] = params.incubationDays
      newInfections++
    }
    if (turnover > 0 && state[p] === RECOVERED && rng.next() < turnover) {
      state[p] = SUSCEPTIBLE
    }
  }
  return newInfections
}