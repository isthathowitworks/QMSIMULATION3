import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { MapData, MunicipalityShape } from '../src/state/loadMap'
import { rewind, shapePaths } from '../src/ui/map/mapGeometry'

function area(ring: number[][]): number {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  return sum / 2
}

// Runs counterclockwise (positive area).
const ccwSquare = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
]
// Runs clockwise (negative area).
const cwHole = [
  [2, 2],
  [2, 4],
  [4, 4],
  [4, 2],
  [2, 2],
]

function polygon(name: string, rings: number[][][]): MunicipalityShape {
  return { type: 'Feature', properties: { adm3_en: name }, geometry: { type: 'Polygon', coordinates: rings } }
}

const real = JSON.parse(readFileSync('public/data/camarines_norte_map.json', 'utf8')) as MapData

describe('rewind', () => {
  it('makes the outer ring clockwise and a hole counterclockwise', () => {
    const out = rewind(polygon('A', [ccwSquare, cwHole]))
    if (out.geometry.type !== 'Polygon') throw new Error('expected a Polygon')
    const [outer, hole] = out.geometry.coordinates
    expect(area(outer)).toBeLessThan(0)
    expect(area(hole)).toBeGreaterThan(0)
  })

  it('keeps every point of every ring', () => {
    const out = rewind(polygon('A', [ccwSquare, cwHole]))
    if (out.geometry.type !== 'Polygon') throw new Error('expected a Polygon')
    expect(out.geometry.coordinates[0]).toHaveLength(5)
    expect(out.geometry.coordinates[1]).toHaveLength(5)
  })

  it('does not change the input', () => {
    const input = polygon('A', [ccwSquare])
    rewind(input)
    expect(area(ccwSquare)).toBeGreaterThan(0)
    if (input.geometry.type !== 'Polygon') throw new Error('expected a Polygon')
    expect(input.geometry.coordinates[0][1]).toEqual([10, 0])
  })

  it('leaves a ring that already has the right direction as it is', () => {
    const cwSquare = [...ccwSquare].reverse()
    const out = rewind(polygon('A', [cwSquare]))
    if (out.geometry.type !== 'Polygon') throw new Error('expected a Polygon')
    expect(out.geometry.coordinates[0]).toEqual(cwSquare)
  })

  it('winds every part of a MultiPolygon', () => {
    const multi: MunicipalityShape = {
      type: 'Feature',
      properties: { adm3_en: 'M' },
      geometry: { type: 'MultiPolygon', coordinates: [[ccwSquare], [ccwSquare]] },
    }
    const out = rewind(multi)
    if (out.geometry.type !== 'MultiPolygon') throw new Error('expected a MultiPolygon')
    for (const part of out.geometry.coordinates) expect(area(part[0])).toBeLessThan(0)
  })
})

describe('shapePaths', () => {
  it('gives an empty list for an empty map', () => {
    expect(shapePaths({ type: 'FeatureCollection', features: [] }, 400, 360)).toEqual([])
  })

  it('gives one path per shape, in the order of the file, with the municipality names', () => {
    const paths = shapePaths(real, 400, 360)
    expect(paths).toHaveLength(12)
    expect(paths.map((p) => p.name)).toEqual(real.features.map((f) => f.properties.adm3_en))
  })

  it('has a real path for every shape and no NaN', () => {
    for (const p of shapePaths(real, 400, 360)) {
      expect(p.d.startsWith('M')).toBe(true)
      expect(p.d).not.toContain('NaN')
    }
  })

  it('keeps every point inside the box, with the padding', () => {
    const width = 400
    const height = 360
    const padding = 4
    let maxX = 0
    let maxY = 0
    for (const p of shapePaths(real, width, height, padding)) {
      const numbers = (p.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        const x = numbers[i]
        const y = numbers[i + 1]
        expect(x).toBeGreaterThanOrEqual(padding - 0.5)
        expect(x).toBeLessThanOrEqual(width - padding + 0.5)
        expect(y).toBeGreaterThanOrEqual(padding - 0.5)
        expect(y).toBeLessThanOrEqual(height - padding + 0.5)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
    // The map is scaled up until it touches the box on one side (not shrunk to a dot, not blown up).
    expect(maxX > width - padding - 1 || maxY > height - padding - 1).toBe(true)
  })
})