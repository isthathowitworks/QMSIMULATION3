// Gives every household a made-up position on the map: a random point inside the shape of its municipality,
// in the same box as the map shapes (same projection as shapePaths), so the dots lie on the shapes.
// The positions are NOT real house locations. The same seed always gives the same positions,
// so the dots never move between runs or page loads.
// Plain TypeScript, no React.

import { createRng } from '../../engine/rng'
import type { MapData, MunicipalityShape } from '../../state/loadMap'
import { mapProjection } from './mapGeometry'

type Ring = number[][]

export const DOT_SEED = 1
const MAX_TRIES = 1000 // draws per household before the fallback point is used

// The part of a barangay entry that is needed here (population.json has more).
export interface BarangayHouseholds {
  municipality: string
  households: number
}

export interface HouseholdMunicipalities {
  names: string[] // municipality names, in order of first appearance (same as World.municipalities)
  of: Uint8Array // one entry per household, in world order: index into names
}

// Which municipality each household is in, built the same way as buildWorld does:
// barangays in file order, the households of a barangay one after the other.
export function householdMunicipalities(barangays: BarangayHouseholds[]): HouseholdMunicipalities {
  const names: string[] = []
  let total = 0
  for (const b of barangays) {
    if (!names.includes(b.municipality)) names.push(b.municipality)
    total += b.households
  }
  const of = new Uint8Array(total)
  let h = 0
  for (const b of barangays) {
    const k = names.indexOf(b.municipality)
    for (let i = 0; i < b.households; i++) of[h++] = k
  }
  return { names, of }
}

export interface HouseholdPositions {
  x: Float64Array // one entry per household, in world order, in the map box
  y: Float64Array
}

// One municipality shape, ready for drawing points inside it.
interface Region {
  polygons: Ring[][] // each polygon: the outer ring first, then the holes
  minLon: number
  maxLon: number
  minLat: number
  maxLat: number
  start: [number, number] // a point on the shape, used if no point inside it is found
}

function regionOf(shape: MunicipalityShape): Region {
  const g = shape.geometry
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const rings of polygons) {
    for (const ring of rings) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon
        if (lon > maxLon) maxLon = lon
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }
  }
  if (minLon === Infinity) {
    minLon = maxLon = minLat = maxLat = 0
  }
  const first = polygons[0]?.[0]?.[0]
  return { polygons, minLon, maxLon, minLat, maxLat, start: first ? [first[0], first[1]] : [0, 0] }
}

// Even-odd test in plain longitude and latitude (municipalities are small, so this is accurate enough).
function inRing(ring: Ring, x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// Inside a polygon means inside its outer ring and not inside a hole (even-odd over all its rings).
function contains(region: Region, lon: number, lat: number): boolean {
  return region.polygons.some((rings) => {
    let inside = false
    for (const ring of rings) if (inRing(ring, lon, lat)) inside = !inside
    return inside
  })
}

// One position per household, in world order, inside the box width x height.
// Gives null when a municipality of the households is not on the map (or a household points at a
// municipality that is not in the list), so the page shows no dots instead of wrong ones.
// `padding` must be the one the map shapes are drawn with.
export function householdPositions(
  map: MapData,
  municipalities: HouseholdMunicipalities,
  width: number,
  height: number,
  seed = DOT_SEED,
  padding = 4,
): HouseholdPositions | null {
  const { names, of } = municipalities
  if (of.length === 0) return { x: new Float64Array(0), y: new Float64Array(0) }

  const byName = new Map<string, MunicipalityShape>()
  for (const f of map.features) {
    if (!byName.has(f.properties.adm3_en)) byName.set(f.properties.adm3_en, f)
  }
  const regions: Region[] = []
  for (const name of names) {
    const shape = byName.get(name)
    if (!shape) return null
    regions.push(regionOf(shape))
  }

  const projection = mapProjection(map, width, height, padding)
  const rng = createRng(seed)
  const x = new Float64Array(of.length)
  const y = new Float64Array(of.length)

  for (let h = 0; h < of.length; h++) {
    const region = regions[of[h]]
    if (!region) return null
    let placed = false
    for (let t = 0; t < MAX_TRIES && !placed; t++) {
      const lon = region.minLon + rng.next() * (region.maxLon - region.minLon)
      const lat = region.minLat + rng.next() * (region.maxLat - region.minLat)
      if (!contains(region, lon, lat)) continue
      const p = projection([lon, lat])
      if (!p) continue
      x[h] = p[0]
      y[h] = p[1]
      placed = true
    }
    if (!placed) {
      const p = projection(region.start) ?? [width / 2, height / 2]
      x[h] = p[0]
      y[h] = p[1]
    }
  }
  return { x, y }
}