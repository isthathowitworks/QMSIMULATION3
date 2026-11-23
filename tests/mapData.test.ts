import { describe, expect, it } from 'vitest'
import type { Comparison } from '../src/state/curve'
import { loadMapFiles, mapColumns } from '../src/state/mapData'
import type { PopulationData } from '../src/state/municipalities'

const square = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
  ],
}

const mapBody = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { adm3_en: 'A' }, geometry: square },
    { type: 'Feature', properties: { adm3_en: 'B' }, geometry: square },
  ],
}

const populationBody = {
  barangays: [
    { municipality: 'A', simPeople: 100, households: 20 },
    { municipality: 'B', simPeople: 50, households: 10 },
    { municipality: 'A', simPeople: 100, households: 20 },
  ],
}

function fakeFetch(mapStatus = 200, populationStatus = 200) {
  const asked: string[] = []
  const fetchFn = (async (url: string) => {
    asked.push(url)
    if (url.endsWith('camarines_norte_map.json')) {
      return new Response(JSON.stringify(mapBody), { status: mapStatus })
    }
    return new Response(JSON.stringify(populationBody), { status: populationStatus })
  }) as unknown as typeof fetch
  return { fetchFn, asked }
}

function comparisonWith(baseline: number[], policy: number[]): Comparison {
  return {
    baselineBitesByMunicipality: baseline,
    policyBitesByMunicipality: policy,
  } as unknown as Comparison
}

const population = populationBody as unknown as PopulationData

describe('loadMapFiles', () => {
  it('asks for the map file and the population file under the base url', async () => {
    const { fetchFn, asked } = fakeFetch()
    await loadMapFiles('/qm/', fetchFn)
    expect([...asked].sort()).toEqual(['/qm/data/camarines_norte_map.json', '/qm/data/population.json'])
  })

  it('returns both files', async () => {
    const { fetchFn } = fakeFetch()
    const files = await loadMapFiles('/', fetchFn)
    expect(files.map.features).toHaveLength(2)
    expect(files.population.barangays).toHaveLength(3)
  })

  it('throws when the map file cannot be loaded', async () => {
    const { fetchFn } = fakeFetch(404, 200)
    await expect(loadMapFiles('/', fetchFn)).rejects.toThrow('status 404')
  })

  it('throws when the population file cannot be loaded', async () => {
    const { fetchFn } = fakeFetch(200, 500)
    await expect(loadMapFiles('/', fetchFn)).rejects.toThrow('status 500')
  })
})

describe('mapColumns', () => {
  it('gives the names in the order of first appearance in the population file', () => {
    const columns = mapColumns(comparisonWith([0, 0], [0, 0]), population)
    expect(columns?.names).toEqual(['A', 'B'])
  })

  it('works out bite infections per 1,000 simulated people for both runs', () => {
    // A has 200 simulated people, B has 50
    const columns = mapColumns(comparisonWith([20, 5], [10, 1]), population)
    expect(columns).not.toBeNull()
    expect(columns?.baseline[0]).toBeCloseTo(100)
    expect(columns?.baseline[1]).toBeCloseTo(100)
    expect(columns?.policy[0]).toBeCloseTo(50)
    expect(columns?.policy[1]).toBeCloseTo(20)
  })

  it('gives lists as long as the names', () => {
    const columns = mapColumns(comparisonWith([20, 5], [10, 1]), population)
    expect(columns?.baseline).toHaveLength(2)
    expect(columns?.policy).toHaveLength(2)
  })

  it('gives null when the run has a different number of municipalities than the population file', () => {
    expect(mapColumns(comparisonWith([1, 2, 3], [1, 2, 3]), population)).toBeNull()
    expect(mapColumns(comparisonWith([1, 2], [1, 2, 3]), population)).toBeNull()
    expect(mapColumns(comparisonWith([1], [1, 2]), population)).toBeNull()
  })
})