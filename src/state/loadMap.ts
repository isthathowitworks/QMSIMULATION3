// Loads public/data/camarines_norte_map.json in the page, the same way loadPopulation.ts loads population.json.
// The file is GeoJSON: one shape (Polygon or MultiPolygon) per municipality, with the name in adm3_en.

import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'

export interface MunicipalityProperties {
  adm3_en: string
}

export type MunicipalityShape = Feature<Polygon | MultiPolygon, MunicipalityProperties>
export type MapData = FeatureCollection<Polygon | MultiPolygon, MunicipalityProperties>

// `baseUrl` is import.meta.env.BASE_URL in the page. `fetchFn` is only given in tests.
export async function loadMap(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<MapData> {
  const url = `${baseUrl}data/camarines_norte_map.json`
  const response = await fetchFn(url)
  if (!response.ok) throw new Error(`could not load ${url} (status ${response.status})`)
  const map = (await response.json()) as MapData
  if (map.type !== 'FeatureCollection' || !Array.isArray(map.features) || map.features.length === 0) {
    throw new Error(`${url} has no shapes`)
  }
  const ok = map.features.every(
    (f) =>
      (f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon') &&
      typeof f.properties?.adm3_en === 'string',
  )
  if (!ok) {
    throw new Error(`${url} has a shape that is not a Polygon or MultiPolygon, or has no municipality name`)
  }
  return map
}