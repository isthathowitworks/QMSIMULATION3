// Builds the simulated people and households from public/data/population.json.
// Everything is stored in flat typed arrays (fast for ~19,000 people).

export const SUSCEPTIBLE = 0
export const EXPOSED = 1
export const INFECTIOUS = 2
export const RECOVERED = 3

export interface BarangayInput {
  municipality: string
  barangay: string
  population: number
  simPeople: number
  households: number
}

export interface PopulationFile {
  peoplePerSimPerson: number
  peoplePerHousehold: number
  barangays: BarangayInput[]
}

export interface BarangayInfo {
  municipality: number // index into World.municipalities
  name: string
  firstHousehold: number
  householdCount: number
}

export interface World {
  municipalities: string[]
  barangays: BarangayInfo[]
  // one entry per household
  householdMunicipality: Uint8Array
  householdBarangay: Uint8Array
  householdFirstPerson: Int32Array
  householdSize: Uint8Array
  // one entry per person
  personHousehold: Int32Array
  personState: Uint8Array
}

export function buildWorld(file: PopulationFile): World {
  const municipalities: string[] = []
  for (const b of file.barangays) {
    if (!municipalities.includes(b.municipality)) municipalities.push(b.municipality)
  }

  const totalHouseholds = file.barangays.reduce((s, b) => s + b.households, 0)
  const totalPeople = file.barangays.reduce((s, b) => s + b.simPeople, 0)

  const householdMunicipality = new Uint8Array(totalHouseholds)
  const householdBarangay = new Uint8Array(totalHouseholds)
  const householdFirstPerson = new Int32Array(totalHouseholds)
  const householdSize = new Uint8Array(totalHouseholds)
  const personHousehold = new Int32Array(totalPeople)
  const personState = new Uint8Array(totalPeople) // 0 = SUSCEPTIBLE for everyone

  const barangays: BarangayInfo[] = []
  let h = 0
  let p = 0
  file.barangays.forEach((b, bi) => {
    if (b.households < 1) throw new Error(`${b.barangay}: no households`)
    const municipality = municipalities.indexOf(b.municipality)
    barangays.push({ municipality, name: b.barangay, firstHousehold: h, householdCount: b.households })

    // Spread the people evenly: some households get one extra person.
    const base = Math.floor(b.simPeople / b.households)
    const extra = b.simPeople % b.households
    for (let i = 0; i < b.households; i++) {
      const size = base + (i < extra ? 1 : 0)
      householdMunicipality[h] = municipality
      householdBarangay[h] = bi
      householdFirstPerson[h] = p
      householdSize[h] = size
      for (let k = 0; k < size; k++) personHousehold[p + k] = h
      p += size
      h += 1
    }
  })

  return {
    municipalities,
    barangays,
    householdMunicipality,
    householdBarangay,
    householdFirstPerson,
    householdSize,
    personHousehold,
    personState,
  }
}