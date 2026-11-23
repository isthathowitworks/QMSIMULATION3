import { readFileSync } from 'node:fs'
import { geoContains } from 'd3-geo'
import { describe, expect, it } from 'vitest'
import { buildWorld } from '../src/engine/population'
import type { PopulationFile } from '../src/engine/population'
import type { MapData, MunicipalityShape } from '../src/state/loadMap'
import { mapProjection, rewind } from '../src/ui/map/mapGeometry'
import { householdMunicipalities, householdPositions } from '../src/ui/map/householdPositions'

const W = 400
const H = 360
const PAD = 4

const population = JSON.parse(readFileSync('public/data/population.json', 'utf8')) as PopulationFile
const real = JSON.parse(readFileSync('public/data/camarines_norte_map.json', 'utf8')) as MapData
const mun = householdMunicipalities(population.barangays)

function shape(name: string, rings: number[][][]): MunicipalityShape {
  return { type: 'Feature', properties: { adm3_en: name }, geometry: { type: 'Polygon', coordinates: rings } }
}

// A square of one degree, with and without a big hole in the middle.
const outer = [
  [120, 14],
  [121, 14],
  [121, 15],
  [120, 15],
  [120, 14],
]
const hole = [
  [120.1, 14.1],
  [120.1, 14.9],
  [120.9, 14.9],
  [120.9, 14.1],
  [120.1, 14.1],
]

function mapOf(...shapes: MunicipalityShape[]): MapData {
  return { type: 'FeatureCollection', features: shapes }
}

// The longitude and latitude behind a position in the box.
function lonLat(map: MapData, x: number, y: number): [number, number] {
  const projection = mapProjection(map, W, H, PAD)
  if (!projection.invert) throw new Error('projection cannot be inverted')
  const p = projection.invert([x, y])
  if (!p) throw new Error('no longitude and latitude for this position')
  return p
}

describe('householdMunicipalities', () => {
  it('numbers the households barangay by barangay and the municipalities by first appearance', () => {
    const out = householdMunicipalities([
      { municipality: 'A', households: 2 },
      { municipality: 'B', households: 1 },
      { municipality: 'A', households: 3 },
    ])
    expect(out.names).toEqual(['A', 'B'])
    expect(Array.from(out.of)).toEqual([0, 0, 1, 0, 0, 0])
  })

  it('agrees with buildWorld on the real population file', () => {
    const world = buildWorld(population)
    expect(mun.names).toEqual(world.municipalities)
    expect(Array.from(mun.of)).toEqual(Array.from(world.householdMunicipality))
  })
})

describe('householdPositions', () => {
  it('gives one position per household, 3,797 for the real file', () => {
    const pos = householdPositions(real, mun, W, H)
    if (!pos) throw new Error('expected positions')
    expect(mun.of.length).toBe(3797)
    expect(pos.x.length).toBe(3797)
    expect(pos.y.length).toBe(3797)
  })

  it('keeps every position inside the box, with the padding, and never gives NaN', () => {
    const pos = householdPositions(real, mun, W, H)
    if (!pos) throw new Error('expected positions')
    for (let h = 0; h < pos.x.length; h++) {
      expect(Number.isFinite(pos.x[h])).toBe(true)
      expect(Number.isFinite(pos.y[h])).toBe(true)
      expect(pos.x[h]).toBeGreaterThanOrEqual(PAD - 0.5)
      expect(pos.x[h]).toBeLessThanOrEqual(W - PAD + 0.5)
      expect(pos.y[h]).toBeGreaterThanOrEqual(PAD - 0.5)
      expect(pos.y[h]).toBeLessThanOrEqual(H - PAD + 0.5)
    }
  })

  it('puts the households inside the shape of their own municipality (every 10th checked)', () => {
    const pos = householdPositions(real, mun, W, H)
    if (!pos) throw new Error('expected positions')
    const shapes = new Map(real.features.map((f) => [f.properties.adm3_en, rewind(f)]))
    for (let h = 0; h < pos.x.length; h += 10) {
      const own = shapes.get(mun.names[mun.of[h]])
      if (!own) throw new Error('shape missing')
      expect(geoContains(own, lonLat(real, pos.x[h], pos.y[h]))).toBe(true)
    }
  })

  it('gives the same positions for the same seed and other positions for another seed', () => {
    const a = householdPositions(real, mun, W, H, 5)
    const b = householdPositions(real, mun, W, H, 5)
    const c = householdPositions(real, mun, W, H, 6)
    if (!a || !b || !c) throw new Error('expected positions')
    expect(Array.from(b.x)).toEqual(Array.from(a.x))
    expect(Array.from(b.y)).toEqual(Array.from(a.y))
    expect(Array.from(c.x)).not.toEqual(Array.from(a.x))
  })

  it('gives different households different positions', () => {
    const pos = householdPositions(real, mun, W, H)
    if (!pos) throw new Error('expected positions')
    const seen = new Set<string>()
    for (let h = 0; h < pos.x.length; h++) seen.add(`${pos.x[h]},${pos.y[h]}`)
    expect(seen.size).toBeGreaterThan(pos.x.length * 0.95)
  })

  it('keeps the dots out of a hole in the shape', () => {
    const map = mapOf(shape('S', [outer, hole]))
    const pos = householdPositions(map, { names: ['S'], of: new Uint8Array(50) }, W, H)
    if (!pos) throw new Error('expected positions')
    const eps = 1e-6
    for (let h = 0; h < 50; h++) {
      const [lon, lat] = lonLat(map, pos.x[h], pos.y[h])
      expect(lon).toBeGreaterThan(120)
      expect(lon).toBeLessThan(121)
      expect(lat).toBeGreaterThan(14)
      expect(lat).toBeLessThan(15)
      const inHole = lon > 120.1 - eps && lon < 120.9 + eps && lat > 14.1 - eps && lat < 14.9 + eps
      expect(inHole).toBe(false)
    }
  })

  it('uses a point of the shape when no point inside it can be found', () => {
    const sliver = shape('T', [
      [
        [120.2, 14.2],
        [120.4, 14.2],
        [120.2, 14.2],
      ],
    ])
    const map = mapOf(shape('S', [outer]), sliver)
    const pos = householdPositions(map, { names: ['S', 'T'], of: Uint8Array.from([0, 1, 1]) }, W, H)
    if (!pos) throw new Error('expected positions')
    const expected = mapProjection(map, W, H, PAD)([120.2, 14.2])
    if (!expected) throw new Error('no projection')
    expect(pos.x[1]).toBeCloseTo(expected[0], 6)
    expect(pos.y[1]).toBeCloseTo(expected[1], 6)
    expect(pos.x[2]).toBeCloseTo(expected[0], 6)
    expect(Number.isFinite(pos.x[0])).toBe(true)
  })

  it('gives null when a municipality is not on the map', () => {
    const map = mapOf(shape('S', [outer]))
    expect(householdPositions(map, { names: ['S', 'Missing'], of: Uint8Array.from([0, 1]) }, W, H)).toBeNull()
  })

  it('gives null when a household points at a municipality that is not in the list', () => {
    const map = mapOf(shape('S', [outer]))
    expect(householdPositions(map, { names: ['S'], of: Uint8Array.from([0, 1]) }, W, H)).toBeNull()
  })

  it('gives empty lists for no households', () => {
    const pos = householdPositions(real, { names: [], of: new Uint8Array(0) }, W, H)
    if (!pos) throw new Error('expected positions')
    expect(pos.x.length).toBe(0)
    expect(pos.y.length).toBe(0)
  })

  it('does not change the map that was passed in', () => {
    const before = JSON.stringify(real)
    householdPositions(real, mun, W, H)
    expect(JSON.stringify(real)).toBe(before)
  })
})