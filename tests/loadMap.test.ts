import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadMap } from '../src/state/loadMap'

function fakeFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
}

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

function feature(name: unknown, geometry: unknown = square) {
  return { type: 'Feature', properties: { adm3_en: name }, geometry }
}

describe('loadMap', () => {
  it('asks for the map file under the base url', async () => {
    let asked = ''
    const fetchFn = (async (url: string) => {
      asked = url
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [feature('A')] }))
    }) as unknown as typeof fetch
    await loadMap('/qm/', fetchFn)
    expect(asked).toBe('/qm/data/camarines_norte_map.json')
  })

  it('returns the map when it is fine', async () => {
    const map = await loadMap('/', fakeFetch({ type: 'FeatureCollection', features: [feature('A'), feature('B')] }))
    expect(map.features).toHaveLength(2)
    expect(map.features[0].properties.adm3_en).toBe('A')
  })

  it('throws when the file cannot be loaded', async () => {
    await expect(loadMap('/', fakeFetch({}, 404))).rejects.toThrow('status 404')
  })

  it('throws when there are no shapes', async () => {
    await expect(loadMap('/', fakeFetch({ type: 'FeatureCollection', features: [] }))).rejects.toThrow('no shapes')
    await expect(loadMap('/', fakeFetch({ nothing: true }))).rejects.toThrow('no shapes')
  })

  it('throws when a shape has no name or the wrong kind of geometry', async () => {
    await expect(
      loadMap('/', fakeFetch({ type: 'FeatureCollection', features: [feature(5)] })),
    ).rejects.toThrow('municipality name')
    await expect(
      loadMap('/', fakeFetch({ type: 'FeatureCollection', features: [feature('A', { type: 'Point', coordinates: [0, 0] })] })),
    ).rejects.toThrow('Polygon or MultiPolygon')
  })

  it('accepts the real map file: 12 shapes with names', async () => {
    const real = JSON.parse(readFileSync('public/data/camarines_norte_map.json', 'utf8'))
    const map = await loadMap('/', fakeFetch(real))
    expect(map.features).toHaveLength(12)
    expect(map.features.every((f) => f.properties.adm3_en.length > 0)).toBe(true)
  })
})