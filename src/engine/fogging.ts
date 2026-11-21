// Fogging (step 4a), copied from the earlier Python engine.
// A municipality is fogged when its reported cases over the last 7 days reach its trigger
// and the wait since its last round is over. Fogged households lose adult mosquitoes.

import type { Mosquitoes } from './mosquitoes'
import { EMAX } from './mosquitoes'
import type { Params } from './params'
import type { Rng } from './rng'

export const FOG_WINDOW_DAYS = 7

export interface FogState {
  lastFog: Int32Array // day of the last round, one per municipality
  events: Int32Array // number of rounds so far, one per municipality
}

export function createFogState(municipalityCount: number): FogState {
  return {
    lastFog: new Int32Array(municipalityCount).fill(-1_000_000),
    events: new Int32Array(municipalityCount),
  }
}

// `onsets` has one row per recorded day and one column per municipality (flat, row first).
// `daysRecorded` is how many rows exist so far; only earlier days count, not today.
// `trigger` is the reported-case trigger per municipality (world order).
export function applyFogging(
  m: Mosquitoes,
  householdMunicipality: ArrayLike<number>,
  municipalityCount: number,
  trigger: ArrayLike<number>,
  onsets: ArrayLike<number>,
  daysRecorded: number,
  day: number,
  fog: FogState,
  params: Params,
  rng: Rng,
): void {
  if (daysRecorded <= 0 || params.fogCoverage <= 0) return
  const first = Math.max(0, daysRecorded - FOG_WINDOW_DAYS)
  const keep = 1 - params.fogKill

  for (let k = 0; k < municipalityCount; k++) {
    let sum = 0
    for (let d = first; d < daysRecorded; d++) sum += onsets[d * municipalityCount + k]
    const reported = sum * params.scale * params.reportFrac
    if (reported <= 0 || reported < trigger[k]) continue
    if (day - fog.lastFog[k] < params.fogCooldown) continue

    for (let h = 0; h < m.households; h++) {
      if (householdMunicipality[h] !== k) continue
      if (rng.next() >= params.fogCoverage) continue
      m.Sm[h] = rng.binomial(m.Sm[h], keep)
      m.Im[h] = rng.binomial(m.Im[h], keep)
      const row = h * EMAX
      for (let e = 0; e < EMAX; e++) {
        const v = m.em[row + e]
        if (v > 0) m.em[row + e] = rng.binomial(v, keep)
      }
    }
    fog.lastFog[k] = day
    fog.events[k]++
  }
}