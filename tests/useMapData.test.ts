import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { loadMapState, useMapData } from '../src/state/useMapData'

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
  features: [{ type: 'Feature', properties: { adm3_en: 'A' }, geometry: square }],
}

const populationBody = { barangays: [{ municipality: 'A', simPeople: 100, households: 20 }] }

function fakeFetch(mapStatus = 200, populationStatus = 200): typeof fetch {
  return (async (url: string) => {
    if (url.endsWith('camarines_norte_map.json')) {
      return new Response(JSON.stringify(mapBody), { status: mapStatus })
    }
    return new Response(JSON.stringify(populationBody), { status: populationStatus })
  }) as unknown as typeof fetch
}

describe('loadMapState', () => {
  it('is ready with both files when everything loads', async () => {
    const state = await loadMapState('/', fakeFetch())
    expect(state.status).toBe('ready')
    if (state.status !== 'ready') throw new Error('expected ready')
    expect(state.files.map.features).toHaveLength(1)
    expect(state.files.population.barangays).toHaveLength(1)
  })

  it('is failed with the reason when the map file cannot be loaded', async () => {
    const state = await loadMapState('/', fakeFetch(404, 200))
    expect(state.status).toBe('failed')
    if (state.status !== 'failed') throw new Error('expected failed')
    expect(state.message).toContain('status 404')
  })

  it('is failed with the reason when the population file cannot be loaded', async () => {
    const state = await loadMapState('/', fakeFetch(200, 500))
    expect(state.status).toBe('failed')
    if (state.status !== 'failed') throw new Error('expected failed')
    expect(state.message).toContain('status 500')
  })

  it('is failed, and does not throw, when the request itself fails', async () => {
    const fetchFn = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    const state = await loadMapState('/', fetchFn)
    expect(state).toEqual({ status: 'failed', message: 'network down' })
  })
})

describe('useMapData', () => {
  it('starts as loading and fetches nothing while the page is drawn the first time', () => {
    function Probe() {
      return createElement('p', null, useMapData('/').status)
    }
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<p>loading</p>')
  })
})