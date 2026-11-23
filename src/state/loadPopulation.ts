// Loads public/data/population.json in the page, the same way loadParams.ts loads settings.json.
// The map needs the municipality names, the simulated people per municipality and the households
// per barangay (for the household dots).

import type { PopulationData } from './municipalities'

// `baseUrl` is import.meta.env.BASE_URL in the page. `fetchFn` is only given in tests.
export async function loadPopulation(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<PopulationData> {
  const url = `${baseUrl}data/population.json`
  const response = await fetchFn(url)
  if (!response.ok) throw new Error(`could not load ${url} (status ${response.status})`)
  const population = (await response.json()) as PopulationData
  if (!Array.isArray(population.barangays) || population.barangays.length === 0) {
    throw new Error(`${url} has no barangays`)
  }
  const ok = population.barangays.every(
    (b) =>
      typeof b.municipality === 'string' &&
      typeof b.simPeople === 'number' &&
      Number.isFinite(b.simPeople) &&
      Number.isInteger(b.households) &&
      b.households >= 0,
  )
  if (!ok) {
    throw new Error(
      `${url} has a barangay without a municipality name, or with simPeople or households that is not a number (households must be a whole number, 0 or more)`,
    )
  }
  return population
}