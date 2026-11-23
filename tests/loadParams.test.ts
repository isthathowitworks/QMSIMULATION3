import { describe, it, expect } from 'vitest'
import { loadParams } from '../src/state/loadParams'
import { DEFAULT_PARAMS } from '../src/engine/params'

function fakeFetch(body: unknown, status = 200) {
  const urls: string[] = []
  const f = (async (url: string) => {
    urls.push(url)
    return { ok: status === 200, status, json: async () => body }
  }) as unknown as typeof fetch
  return { f, urls }
}

const settings = {
  fitted: true,
  bitingRate: 0.2353,
  carryingCapacityPerPerson: 1.1488,
  reportingFraction: 0.0076,
  importedSurgeSize: 23.1133,
}

describe('loadParams', () => {
  it('asks for data/settings.json under the base url', async () => {
    const { f, urls } = fakeFetch(settings)
    await loadParams('/app/', f)
    expect(urls).toEqual(['/app/data/settings.json'])
  })

  it('lays the four fitted settings over the starting positions', async () => {
    const params = await loadParams('/', fakeFetch(settings).f)
    expect(params.biteRate).toBe(0.2353)
    expect(params.kPerPerson).toBe(1.1488)
    expect(params.reportFrac).toBe(0.0076)
    expect(params.importedSurgeSize).toBe(23.1133)
    expect(params.cleanKill).toBe(DEFAULT_PARAMS.cleanKill)
    expect(params.spinupDays).toBe(DEFAULT_PARAMS.spinupDays)
  })

  it('throws with the status when the file cannot be loaded', async () => {
    await expect(loadParams('/', fakeFetch({}, 404).f)).rejects.toThrow('status 404')
  })

  it('throws when a setting is missing or not a number', async () => {
    const broken = { ...settings, biteRate: undefined, bitingRate: 'fast' }
    await expect(loadParams('/', fakeFetch(broken).f)).rejects.toThrow('not a number')
  })
})