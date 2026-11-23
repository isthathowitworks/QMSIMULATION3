// Counts the households in each state for each municipality, at one week of one run (6.3e).
// A household's state is the highest state in the household (0 susceptible, 1 exposed, 2 infectious,
// 3 recovered), as recorded every 7 days by the engine. Plain functions: no fetching, no drawing, no React.

export interface MunicipalityHouseholds {
  name: string
  households: number
  susceptible: number
  exposed: number
  infectious: number
  recovered: number
}

// the state codes 0 to 3, in order
const STATE_KEYS = ['susceptible', 'exposed', 'infectious', 'recovered'] as const

// `municipalityOf` has one entry per household, in world order: the index into `names`
// (for example `of` from householdMunicipalities). `states` is the flat array of one run: row = week,
// column = household. `snapshot` is the week (row) to count.
// Gives one entry per name, in the order of `names`, with the number of households in each state.
// Gives null when the week is not one of the weeks in `states`, when a household points at a municipality
// that is not in `names`, or when a state code is not 0 to 3, so the page shows no numbers instead of wrong ones.
export function householdStateCounts(
  municipalityOf: ArrayLike<number>,
  names: readonly string[],
  states: ArrayLike<number>,
  snapshot: number,
): MunicipalityHouseholds[] | null {
  const householdCount = municipalityOf.length
  if (!Number.isInteger(snapshot) || snapshot < 0) return null
  const offset = snapshot * householdCount
  if (offset + householdCount > states.length) return null

  const result: MunicipalityHouseholds[] = names.map((name) => ({
    name,
    households: 0,
    susceptible: 0,
    exposed: 0,
    infectious: 0,
    recovered: 0,
  }))

  for (let h = 0; h < householdCount; h++) {
    const entry = result[municipalityOf[h]]
    const key = STATE_KEYS[states[offset + h]]
    if (!entry || !key) return null
    entry.households++
    entry[key]++
  }
  return result
}