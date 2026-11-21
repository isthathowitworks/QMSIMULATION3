// Runs the mosquito-only warm-up before the record starts, like the earlier Python engine.
// Day -150 up to day -1. Weather is read with a wrapping index, so negative days
// use the end of the weather record (late 2025).

import type { Mosquitoes } from './mosquitoes'
import type { Rng } from './rng'
import type { Params } from './params'
import { mosquitoDay } from './daily'
import type { CleaningPlan } from './daily'

// Index into a record of length n, wrapping around. Works for negative days.
export function wrapIndex(day: number, n: number): number {
  return ((day % n) + n) % n
}

// Runs params.spinupDays days of mosquitoes only (no disease). Returns the cleanings per day.
export function runSpinup(
  m: Mosquitoes,
  householdSize: ArrayLike<number>,
  plan: CleaningPlan,
  t2m: ArrayLike<number>,
  rain14: ArrayLike<number>,
  params: Params,
  rng: Rng,
): Int32Array {
  const n = t2m.length
  const cleanings = new Int32Array(params.spinupDays)
  for (let i = 0; i < params.spinupDays; i++) {
    const day = i - params.spinupDays
    const w = wrapIndex(day, n)
    cleanings[i] = mosquitoDay(m, householdSize, plan, day, t2m[w], rain14[w], params, rng)
  }
  return cleanings
}