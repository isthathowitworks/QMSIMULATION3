// Breeding sites and crowding, copied from the earlier Python engine (all are assumptions).
// Rain fills breeding sites; the more larvae already there, the fewer survive.

// Rain over the last 14 days for each day (fewer days at the very start of the record).
export function rolling14(rain: ArrayLike<number>): Float64Array {
  const out = new Float64Array(rain.length)
  let sum = 0
  for (let i = 0; i < rain.length; i++) {
    sum += rain[i]
    if (i >= 14) sum -= rain[i - 14]
    out[i] = sum
  }
  return out
}

// How full the breeding sites are: rainBase in a dry spell, full at rainSatMm, up to 1.5 times full.
export function rainFactor(rain14: number, rainBase = 0.3, rainSatMm = 100): number {
  return rainBase + (1 - rainBase) * Math.min(rain14 / rainSatMm, 1.5)
}

// Most larvae a household can hold. `site` is 1 when no cleaning has reduced the sites.
export function breedingCapacity(people: number, site: number, factor: number, kPerPerson = 2.4): number {
  return kPerPerson * people * site * factor
}

// Share of new eggs that survive. Falls as the household fills up with larvae.
export function larvaSurvival(larvae: number, capacity: number, larvaSurv0 = 0.9): number {
  const s = larvaSurv0 / (1 + larvae / Math.max(capacity, 1e-9))
  return Math.min(1, Math.max(0, s))
}