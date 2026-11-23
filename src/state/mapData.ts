// What the page needs to draw the two maps: the map file and the population file loaded together,
// and the bite infections per 1,000 simulated people for both runs, worked out from a Comparison.
// Plain TypeScript, no React.

import type { Comparison } from './curve'
import { loadMap } from './loadMap'
import type { MapData } from './loadMap'
import { loadPopulation } from './loadPopulation'
import { municipalityPeople, perThousand } from './municipalities'
import type { PopulationData } from './municipalities'

export interface MapFiles {
  map: MapData
  population: PopulationData
}

// Loads both files at the same time. If either one fails, the error from that file is thrown.
// `baseUrl` is import.meta.env.BASE_URL in the page. `fetchFn` is only given in tests.
export async function loadMapFiles(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<MapFiles> {
  const [map, population] = await Promise.all([loadMap(baseUrl, fetchFn), loadPopulation(baseUrl, fetchFn)])
  return { map, population }
}

export interface MapColumns {
  // municipality names, in the order of first appearance in population.json (same as World.municipalities)
  names: string[]
  // bite infections per 1,000 simulated people, same order as names
  baseline: number[]
  policy: number[]
}

// The numbers for the two maps. Null when the run has a different number of municipalities than the
// population file, because then the lists would not line up with the names.
export function mapColumns(comparison: Comparison, population: PopulationData): MapColumns | null {
  const { names, simPeople } = municipalityPeople(population)
  const baselineTotals = comparison.baselineBitesByMunicipality
  const policyTotals = comparison.policyBitesByMunicipality
  if (baselineTotals.length !== names.length || policyTotals.length !== names.length) return null
  return {
    names,
    baseline: perThousand(baselineTotals, simPeople),
    policy: perThousand(policyTotals, simPeople),
  }
}