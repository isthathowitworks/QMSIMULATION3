// Turns the 12 municipality shapes into SVG paths that fit a box.
// The map file has its rings running counterclockwise (the GeoJSON standard), but d3-geo wants the outer
// ring of every polygon to run clockwise (and holes counterclockwise), so the rings are reversed first.

import { geoMercator, geoPath } from 'd3-geo'
import type { GeoProjection } from 'd3-geo'
import type { MapData, MunicipalityShape } from '../../state/loadMap'

type Ring = number[][]

// Positive when the ring runs counterclockwise (x east, y north), negative when clockwise.
function ringArea(ring: Ring): number {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return sum / 2
}

// Outer ring clockwise, holes counterclockwise. A ring with no area is left as it is.
function windPolygon(rings: Ring[]): Ring[] {
  return rings.map((ring, i) => {
    const area = ringArea(ring)
    if (area === 0) return ring
    const isClockwise = area < 0
    const wantClockwise = i === 0
    return isClockwise === wantClockwise ? ring : [...ring].reverse()
  })
}

// A copy of the shape with the rings wound the way d3-geo wants. The input is not changed.
export function rewind(shape: MunicipalityShape): MunicipalityShape {
  const g = shape.geometry
  if (g.type === 'Polygon') {
    return { ...shape, geometry: { type: 'Polygon', coordinates: windPolygon(g.coordinates) } }
  }
  return { ...shape, geometry: { type: 'MultiPolygon', coordinates: g.coordinates.map(windPolygon) } }
}

export interface ShapePath {
  name: string
  d: string
}

// The projection that fits all shapes (already rewound) into the box width x height
// with `padding` left free on every side.
function fitProjection(shapes: MunicipalityShape[], width: number, height: number, padding: number): GeoProjection {
  return geoMercator().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    { type: 'FeatureCollection' as const, features: shapes },
  )
}

// The same projection that shapePaths draws with, so that anything placed with it (the household dots)
// lands exactly on the shapes. Use it only for a map with at least one shape.
export function mapProjection(map: MapData, width: number, height: number, padding = 4): GeoProjection {
  return fitProjection(map.features.map(rewind), width, height, padding)
}

// One SVG path per shape, in the order of the file, all fitted into the box width x height
// with `padding` left free on every side. An empty map gives an empty list.
export function shapePaths(map: MapData, width: number, height: number, padding = 4): ShapePath[] {
  if (map.features.length === 0) return []
  const shapes = map.features.map(rewind)
  const path = geoPath(fitProjection(shapes, width, height, padding))
  return shapes.map((s) => ({ name: s.properties.adm3_en, d: path(s) ?? '' }))
}