// Turns public/data/policy.json into per-household and per-municipality arrays.
// The file lists municipalities in a different order from the world, so we match by name.

import type { World } from './population'

export interface PolicyFile {
  municipalities: {
    municipality: string
    wasteCollectionIntervalDays: number
    foggingTriggerCases: number
  }[]
  centroids: Record<string, { lon: number; lat: number }>
}

export interface PolicyArrays {
  intervals: Int32Array // one per household: days between cleanings (0 or less = never)
  foggingTrigger: Int32Array // one per municipality (world order): cases needed to fog
}

export function buildPolicyArrays(world: World, file: PolicyFile): PolicyArrays {
  const byName = new Map(file.municipalities.map((m) => [m.municipality, m]))

  const interval = new Int32Array(world.municipalities.length)
  const foggingTrigger = new Int32Array(world.municipalities.length)
  world.municipalities.forEach((name, i) => {
    const row = byName.get(name)
    if (!row) throw new Error(`policy file has no row for municipality "${name}"`)
    interval[i] = row.wasteCollectionIntervalDays
    foggingTrigger[i] = row.foggingTriggerCases
  })

  const households = world.householdMunicipality.length
  const intervals = new Int32Array(households)
  for (let h = 0; h < households; h++) {
    intervals[h] = interval[world.householdMunicipality[h]]
  }
  return { intervals, foggingTrigger }
}