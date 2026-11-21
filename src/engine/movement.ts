// 2.6: where everybody spends the day, copied from _locations in the earlier Python engine.
// Each person is away from home with chance pAway. An away person goes to another municipality
// with chance pOtherMuni (chosen by population / distance^gravityBeta), otherwise stays in
// their own. They then spend the day in a random household of that municipality.
// The results (loc, present, infectiousPresent) are what the infection steps take as input.

import type { World } from './population'
import { INFECTIOUS } from './population'
import type { Rng } from './rng'
import type { Params } from './params'

export type Centroids = Record<string, { lon: number; lat: number }>

export interface Movement {
  municipalityCount: number
  gravity: Float64Array // row i, column j: chance that a trip out of i goes to j (rows sum to 1)
  gravityCum: Float64Array // running totals of each row, used to pick a destination
  munStart: Int32Array // households of municipality m are munHouseholds[munStart[m] .. munStart[m + 1] - 1]
  munHouseholds: Int32Array
}

// Distance in km between two (lat, lon) points in degrees.
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Builds the travel table and the household lists. Done once per run.
// Distances below 1 km count as 1 km. A municipality with nowhere else to go sends trips to itself.
export function createMovement(world: World, centroids: Centroids, gravityBeta: number): Movement {
  const M = world.municipalities.length
  const households = world.householdSize.length

  // simulated people per municipality
  const pop = new Float64Array(M)
  for (let h = 0; h < households; h++) pop[world.householdMunicipality[h]] += world.householdSize[h]

  const lat = new Float64Array(M)
  const lon = new Float64Array(M)
  for (let m = 0; m < M; m++) {
    const c = centroids[world.municipalities[m]]
    if (!c) throw new Error(`no centroid for ${world.municipalities[m]}`)
    lat[m] = c.lat
    lon[m] = c.lon
  }

  const gravity = new Float64Array(M * M)
  const gravityCum = new Float64Array(M * M)
  for (let i = 0; i < M; i++) {
    let sum = 0
    for (let j = 0; j < M; j++) {
      if (i === j) continue
      const d = Math.max(haversineKm(lat[i], lon[i], lat[j], lon[j]), 1)
      const g = pop[j] / d ** gravityBeta
      gravity[i * M + j] = g
      sum += g
    }
    if (sum > 0) {
      for (let j = 0; j < M; j++) gravity[i * M + j] /= sum
    } else {
      gravity[i * M + i] = 1
    }
    // running totals; everything from the last possible destination on is exactly 1
    let run = 0
    let lastPositive = i
    for (let j = 0; j < M; j++) {
      run += gravity[i * M + j]
      gravityCum[i * M + j] = run
      if (gravity[i * M + j] > 0) lastPositive = j
    }
    for (let j = lastPositive; j < M; j++) gravityCum[i * M + j] = 1
  }

  // households grouped by municipality
  const munStart = new Int32Array(M + 1)
  for (let h = 0; h < households; h++) munStart[world.householdMunicipality[h] + 1]++
  for (let m = 0; m < M; m++) munStart[m + 1] += munStart[m]
  const fill = munStart.slice(0, M)
  const munHouseholds = new Int32Array(households)
  for (let h = 0; h < households; h++) munHouseholds[fill[world.householdMunicipality[h]]++] = h

  return { municipalityCount: M, gravity, gravityCum, munStart, munHouseholds }
}

// Decides where everyone is today.
//   loc[p]               household where person p spends the day (home if not away)
//   present[h]           people in household h today
//   infectiousPresent[h] infectious people in household h today
// All three arrays are overwritten.
export function placePeople(
  world: World,
  mv: Movement,
  params: Params,
  rng: Rng,
  loc: Int32Array,
  present: Int32Array,
  infectiousPresent: Int32Array,
): void {
  const M = mv.municipalityCount
  const n = world.personState.length
  present.fill(0)
  infectiousPresent.fill(0)

  for (let p = 0; p < n; p++) {
    const home = world.personHousehold[p]
    let where = home
    if (rng.next() < params.pAway) {
      const homeMuni = world.householdMunicipality[home]
      let dest = homeMuni
      if (rng.next() < params.pOtherMuni) {
        const row = homeMuni * M
        const u = rng.next()
        let j = 0
        while (j < M - 1 && u >= mv.gravityCum[row + j]) j++
        dest = j
      }
      const start = mv.munStart[dest]
      const count = mv.munStart[dest + 1] - start
      where = mv.munHouseholds[start + rng.int(count)]
    }
    loc[p] = where
    present[where]++
    if (world.personState[p] === INFECTIOUS) infectiousPresent[where]++
  }
}