// Turns the bite infections of one run (per day and municipality) into one number per
// municipality, and gets the names and simulated people per municipality from the
// population file. Plain functions: no fetching, no drawing, no React.

// The part of public/data/population.json that is needed here.
export interface PopulationData {
  barangays: { municipality: string; simPeople: number }[]
}

export interface MunicipalityPeople {
  names: string[]
  simPeople: number[]
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