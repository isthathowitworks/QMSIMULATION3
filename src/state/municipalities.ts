// Turns the bite infections of one run (per day and municipality) into one number per
// municipality, and gets the names and simulated people per municipality from the
// population file. Plain functions: no fetching, no drawing, no React.

// The part of public/data/population.json that is needed here: the municipality name and the simulated
// people (for the map), and the households (for the household dots).
export interface PopulationData {
  barangays: { municipality: string; simPeople: number; households: number }[]
}

export interface MunicipalityPeople {
  names: string[]
  simPeople: number[]
}

// What the details box shows for one municipality (6.3).
export interface MunicipalityDetails {
  name: string
  // people in the simulation (the real population is about 10 times larger)
  people: number
  // bite infections over the whole run
  infections: number
  // bite infections per 1,000 simulated people (the number the map colors come from)
  perThousand: number
}

// `biteInfections` is the flat array from RunResult: row = day, column = municipality.
// Gives the total over all days for each municipality, in the same order as the columns.
export function biteTotalsPerMunicipality(
  biteInfections: ArrayLike<number>,
  municipalityCount: number,
): number[] {
  if (!Number.isInteger(municipalityCount) || municipalityCount < 1) {
    throw new Error(`municipalityCount must be a whole number of at least 1, got ${municipalityCount}`)
  }
  if (biteInfections.length % municipalityCount !== 0) {
    throw new Error(
      `biteInfections has ${biteInfections.length} values, which is not a whole number of days of ${municipalityCount} municipalities`,
    )
  }
  const totals = new Array<number>(municipalityCount).fill(0)
  for (let i = 0; i < biteInfections.length; i++) {
    totals[i % municipalityCount] += biteInfections[i]
  }
  return totals
}

// Names and simulated people per municipality, in order of first appearance in the file
// (the same order as World.municipalities).
export function municipalityPeople(population: PopulationData): MunicipalityPeople {
  const names: string[] = []
  const simPeople: number[] = []
  const indexOf = new Map<string, number>()
  for (const barangay of population.barangays) {
    let index = indexOf.get(barangay.municipality)
    if (index === undefined) {
      index = names.length
      indexOf.set(barangay.municipality, index)
      names.push(barangay.municipality)
      simPeople.push(0)
    }
    simPeople[index] += barangay.simPeople
  }
  return { names, simPeople }
}

// Bite infections per 1,000 simulated people. A municipality with no people gives 0.
export function perThousand(totals: readonly number[], simPeople: readonly number[]): number[] {
  if (totals.length !== simPeople.length) {
    throw new Error(`got ${totals.length} totals but ${simPeople.length} population numbers`)
  }
  return totals.map((total, i) => (simPeople[i] > 0 ? (total / simPeople[i]) * 1000 : 0))
}

// One entry per municipality for the details box: name, people, bite infections over the whole run
// and bite infections per 1,000 people. `totals` is one run's bite infections per municipality
// (for example Comparison.policyBitesByMunicipality), in the order of first appearance in the
// population file. Throws when the number of totals does not match the number of municipalities.
export function municipalityDetails(
  population: PopulationData,
  totals: readonly number[],
): MunicipalityDetails[] {
  const { names, simPeople } = municipalityPeople(population)
  const rates = perThousand(totals, simPeople)
  return names.map((name, i) => ({
    name,
    people: simPeople[i],
    infections: totals[i],
    perThousand: rates[i],
  }))
}