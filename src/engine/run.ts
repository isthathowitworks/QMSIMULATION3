// The full run: warm-up, then every day of the weather record with disease on.
// Same daily order as the earlier Python engine:
//   1-2 cleaning, 3 development, 4a fogging, 4b adult death, movement,
//   4c mosquitoes catch the virus, 4d people catch it, imports, 4e egg laying,
//   5 people move along E -> I -> R, 6 record the day.
// The world you pass in is never changed: the run works on its own copy of the people.

import type { World } from './population'
import { SUSCEPTIBLE, EXPOSED, INFECTIOUS, RECOVERED } from './population'
import type { Weather } from './weather'
import type { Params } from './params'
import type { PolicyArrays } from './policyData'
import type { Centroids } from './movement'
import type { CleaningPlan } from './daily'
import { createMosquitoes, EMAX } from './mosquitoes'
import { dayStart, dayAdultDeath, dayEggs } from './daily'
import { runSpinup } from './spinup'
import { makeCleaningOffsets } from './schedule'
import { createFogState, applyFogging } from './fogging'
import { mosquitoInfection } from './infection'
import { createMovement, placePeople } from './movement'
import { createTimers, applyInitialImmune, seedInfection, infectPeople, updateHumans } from './humans'
import { importInfections } from './imports'
import { createRng } from './rng'

// Everything recorded during a run. One entry per day, unless it says per municipality.
// The "per municipality" arrays are flat: row = day, column = municipality (world order).
export interface RunResult {
  days: number
  municipalityCount: number
  adults: Int32Array // all adult mosquitoes in the study area (susceptible, exposed, infectious)
  immatures: Int32Array // all immature mosquitoes in the study area (every age, 0 to 24 days)
  infectiousAdults: Int32Array // infectious adult mosquitoes
  cleanings: Int32Array // households that cleaned
  newInfections: Int32Array // simulated people newly infected (mosquito bites plus imports)
  imported: Int32Array // of those, how many were imported from outside
  susceptible: Int32Array // simulated people in each state at the end of the day
  exposed: Int32Array
  infectious: Int32Array
  recovered: Int32Array
  biteInfections: Int32Array // per municipality: people infected by mosquito bites that day (imports left out)
  onsets: Int32Array // per municipality: people who became infectious that day (cases)
  fogged: Uint8Array // per municipality: 1 if a fogging round happened that day
  foggingRounds: Int32Array // per municipality: total rounds over the whole run
}

// `compliance` is the chance per household that a due household really cleans.
// `onProgress` (optional) is called every 30 days and on the last day.
export function runSimulation(
  world: World,
  weather: Weather,
  policy: PolicyArrays,
  centroids: Centroids,
  compliance: Float64Array,
  params: Params,
  seed: number,
  onProgress?: (daysDone: number, totalDays: number) => void,
): RunResult {
  const rng = createRng(seed)

  // own copy of the people, so the caller's world is left alone
  const w: World = { ...world, personState: world.personState.slice() }
  const state = w.personState
  const people = state.length
  const households = w.householdSize.length
  const M = w.municipalities.length
  const days = weather.days

  const m = createMosquitoes(w, params.adultsPerPerson)
  const plan: CleaningPlan = {
    intervals: policy.intervals,
    offsets: makeCleaningOffsets(policy.intervals, rng),
    compliance,
    out: new Uint8Array(households),
  }

  // warm-up: mosquitoes only
  runSpinup(m, w.householdSize, plan, weather.t2m, weather.rain14, params, rng)

  // disease starts on day 0
  applyInitialImmune(w, params.initialImmune, rng)
  const timer = createTimers(w)
  seedInfection(w, timer, params, rng)

  const mv = createMovement(w, centroids, params.gravityBeta)
  const fog = createFogState(M)

  // scratch space reused every day
  const loc = new Int32Array(people)
  const present = new Int32Array(households)
  const infectiousPresent = new Int32Array(households)
  const newE = new Uint8Array(people)
  const pInfect = new Float64Array(households)
  const dayOnsets = new Int32Array(M)
  const dayBites = new Int32Array(M)
  const stateCount = new Int32Array(4) // people per state, indexed by state number

  // the record
  const result: RunResult = {
    days,
    municipalityCount: M,
    adults: new Int32Array(days),
    immatures: new Int32Array(days),
    infectiousAdults: new Int32Array(days),
    cleanings: new Int32Array(days),
    newInfections: new Int32Array(days),
    imported: new Int32Array(days),
    susceptible: new Int32Array(days),
    exposed: new Int32Array(days),
    infectious: new Int32Array(days),
    recovered: new Int32Array(days),
    biteInfections: new Int32Array(days * M),
    onsets: new Int32Array(days * M),
    fogged: new Uint8Array(days * M),
    foggingRounds: new Int32Array(M),
  }

  for (let day = 0; day < days; day++) {
    const tempC = weather.t2m[day]
    const rain14 = weather.rain14[day]

    // steps 1-2 cleaning, 3 development
    result.cleanings[day] = dayStart(m, plan, day, tempC, params, rng)

    // 4a fogging: looks at the cases of the days before today
    applyFogging(
      m, w.householdMunicipality, M, policy.foggingTrigger,
      result.onsets, day, day, fog, params, rng,
    )
    for (let k = 0; k < M; k++) result.fogged[day * M + k] = fog.lastFog[k] === day ? 1 : 0

    // 4b adult death
    dayAdultDeath(m, tempC, rng)

    // where everybody is today
    placePeople(w, mv, params, rng, loc, present, infectiousPresent)

    // 4c mosquitoes catch the virus, 4d people catch it, then imports
    mosquitoInfection(m, infectiousPresent, present, tempC, params, rng)
    infectPeople(w, loc, present, m.Im, params, rng, newE, pInfect)

    // bite infections per municipality: counted here, before imports are added to newE
    dayBites.fill(0)
    for (let p = 0; p < people; p++) {
      if (newE[p]) dayBites[w.householdMunicipality[w.personHousehold[p]]] += 1
    }
    result.biteInfections.set(dayBites, day * M)

    result.imported[day] = importInfections(w, newE, day, params, rng)

    // 4e egg laying
    dayEggs(m, w.householdSize, tempC, rain14, params, rng)

    // 5 people move along E -> I -> R
    result.newInfections[day] = updateHumans(w, timer, newE, params, rng, dayOnsets)

    // 6 record the day
    result.onsets.set(dayOnsets, day * M)

    // adults: one pass over the households, each with its own exposed row
    let adults = 0
    let infectiousAdults = 0
    for (let h = 0; h < households; h++) {
      adults += m.Sm[h] + m.Im[h]
      infectiousAdults += m.Im[h]
      const row = h * EMAX
      for (let d = 0; d < EMAX; d++) adults += m.em[row + d]
    }
    result.adults[day] = adults
    result.infectiousAdults[day] = infectiousAdults

    // immatures: one pass over every household's age columns
    let immatures = 0
    for (let i = 0; i < m.imm.length; i++) immatures += m.imm[i]
    result.immatures[day] = immatures

    // people in each state: one add per person
    stateCount.fill(0)
    for (let p = 0; p < people; p++) stateCount[state[p]]++
    result.susceptible[day] = stateCount[SUSCEPTIBLE]
    result.exposed[day] = stateCount[EXPOSED]
    result.infectious[day] = stateCount[INFECTIOUS]
    result.recovered[day] = stateCount[RECOVERED]

    if (onProgress && (day % 30 === 0 || day === days - 1)) onProgress(day + 1, days)
  }

  for (let k = 0; k < M; k++) result.foggingRounds[k] = fog.events[k]
  return result
}