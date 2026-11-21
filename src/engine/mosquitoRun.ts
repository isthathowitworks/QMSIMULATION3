// Mosquito-only run: the warm-up, then every day of the weather record. No disease yet.
// The full run (with fogging, infection and movement) comes later in run.ts.

import { createMosquitoes } from './mosquitoes'
import type { World } from './population'
import type { Weather } from './weather'
import type { Params } from './params'
import type { CleaningPlan } from './daily'
import { mosquitoDay } from './daily'
import { runSpinup } from './spinup'
import { makeCleaningOffsets } from './schedule'
import { createRng } from './rng'

export interface MosquitoRunResult {
  adults: Int32Array // all adult mosquitoes in the study area, one number per day
  cleanings: Int32Array // households that cleaned, one number per day
}

// `intervals` is days between cleanings per household (0 or less = never).
// `compliance` is the chance per household that a due household really cleans.
export function runMosquitoes(
  world: World,
  weather: Weather,
  intervals: Int32Array,
  compliance: Float64Array,
  params: Params,
  seed: number,
): MosquitoRunResult {
  const rng = createRng(seed)
  const householdSize = world.householdSize
  const m = createMosquitoes(world, params.adultsPerPerson)
  const plan: CleaningPlan = {
    intervals,
    offsets: makeCleaningOffsets(intervals, rng),
    compliance,
    out: new Uint8Array(m.households),
  }

  runSpinup(m, householdSize, plan, weather.t2m, weather.rain14, params, rng)

  const adults = new Int32Array(weather.days)
  const cleanings = new Int32Array(weather.days)
  for (let day = 0; day < weather.days; day++) {
    cleanings[day] = mosquitoDay(
      m, householdSize, plan, day, weather.t2m[day], weather.rain14[day], params, rng,
    )
    let total = 0
    for (let h = 0; h < m.households; h++) total += m.Sm[h] + m.Im[h]
    for (let i = 0; i < m.em.length; i++) total += m.em[i]
    adults[day] = total
  }
  return { adults, cleanings }
}