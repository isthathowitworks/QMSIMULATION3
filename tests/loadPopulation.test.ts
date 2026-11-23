import { describe, it, expect } from 'vitest'
import { loadPopulation } from '../src/state/loadPopulation'

function fakeFetch(body: unknown, status = 200) {
  const urls: string[] = []
  const f = (async (url: string) => {
    urls.push(url)
    return { ok: status === 200, status, json: async () => body }
  }) as unknown as typeof fetch
  return { f, urls }
}

const population = {
  peoplePerSimPerson: 10,
  peoplePerHousehold: 5,
  barangays: [
    { municipality: 'A', barangay: 'One', population: 1000, simPeople: 100, households: 20 },
    { municipality: 'B', barangay: 'Two', population: 500, simPeople: 50, households: 10 },
  ],
}

describe('loadPopulation', () => {
  it('asks for data/population.json under the base url', async () => {
    const { f, urls } = fakeFetch(population)
    await loadPopulation('/app/', f)
    expect(urls).toEqual(['/app/data/population.json'])
  })

  it('returns the file contents', async () => {
    const result = await loadPopulation('/', fakeFetch(population).f)
    expect(result).toEqual(population)
  })

  it('throws with the status when the file cannot be loaded', async () => {
    await expect(loadPopulation('/', fakeFetch({}, 404).f)).rejects.toThrow('status 404')
  })

  it('throws when the file has no barangays', async () => {
    await expect(loadPopulation('/', fakeFetch({ barangays: [] }).f)).rejects.toThrow('no barangays')
    await expect(loadPopulation('/', fakeFetch({}).f)).rejects.toThrow('no barangays')
  })

  it('throws when a barangay has no municipality name or simPeople is not a number', async () => {
    const broken = { barangays: [{ municipality: 'A', simPeople: 'many', households: 20 }] }
    await expect(loadPopulation('/', fakeFetch(broken).f)).rejects.toThrow('not a number')
  })

  it('throws when a barangay has no households', async () => {
    const broken = { barangays: [{ municipality: 'A', simPeople: 100 }] }
    await expect(loadPopulation('/', fakeFetch(broken).f)).rejects.toThrow('households')
  })

  it('throws when households is not a whole number of 0 or more', async () => {
    const fraction = { barangays: [{ municipality: 'A', simPeople: 100, households: 1.5 }] }
    const negative = { barangays: [{ municipality: 'A', simPeople: 100, households: -2 }] }
    await expect(loadPopulation('/', fakeFetch(fraction).f)).rejects.toThrow('households')
    await expect(loadPopulation('/', fakeFetch(negative).f)).rejects.toThrow('households')
  })
})