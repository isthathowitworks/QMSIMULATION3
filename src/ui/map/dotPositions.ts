// Works out the positions of the household dots for the page, from the two loaded files.
// It joins the population file (how many households each barangay has) to the map shapes, using
// householdPositions.ts. The positions are made-up points inside each municipality, NOT real house locations.
// Plain TypeScript, no React. The page works this out once, then keeps the result.

import type { MapFiles } from '../../state/mapData'
import { householdMunicipalities, householdPositions } from './householdPositions'
import type { HouseholdPositions } from './householdPositions'

// One position per household, in world order, inside the box width x height.
// `householdCount` is the number of households in the run. Gives null when the population file has a
// different number of households (the positions would not line up with the household states), or when a
// municipality is not on the map, so the page shows no dots instead of wrong ones.
export function dotPositions(
  files: MapFiles,
  householdCount: number,
  width: number,
  height: number,
): HouseholdPositions | null {
  const municipalities = householdMunicipalities(files.population.barangays)
  if (municipalities.of.length !== householdCount) return null
  return householdPositions(files.map, municipalities, width, height)
}