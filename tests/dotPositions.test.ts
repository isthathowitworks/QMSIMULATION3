import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { MapData } from '../src/state/loadMap'
import type { MapFiles } from '../src/state/mapData'
import type { PopulationData } from '../src/state/municipalities'
import { dotPositions } from '../src/ui/map/dotPositions'

const W = 400
const H = 360

// a unit square starting at longitude x0, counterclockwise like the real map file
function ring(x0: number): number[][] {
  return [
    [x0, 0],
    [x0 + 1, 0],
    [x0 + 1, 1],
    [x0, 1],
    [x0, 0],
  ]
}

function feature(name: string, x0: number) {
  return { type: 'Feature', properties: { adm3_en: name }, geometry: { type: 'Polygon', coordinates: [ring(x0)] } }
}

const twoShapes = {
  type: 'FeatureCollection',
  features: [feature('A', 0), feature('B', 2)],
} as unknown as MapData

const oneShape = {
  type: 'FeatureCollection',
  features: [feature('A', 0)],
} as unknown as MapData

// A has 3 households, B has 2: 5 in all
const population: PopulationData = {
  barangays: [
    { municipality: 'A', simPeople: 30, households: 3 },
    { municipality: 'B', simPeople: 20, households: 2 },
  ],
}

const small: MapFiles = { map: twoShapes, population }

describe('dotPositions', () => {
  it('gives one position per household, inside the box, with no NaN', () => {
    const p = dotPositions(small, 5, W, H)
    expect(p).not.toBeNull()
    if (p === null) throw new Error('expected positions')
    expect(p.x).toHaveLength(5)
    expect(p.y).toHaveLength(5)
    for (let h = 0; h < 5; h++) {
      expect(Number.isFinite(p.x[h])).toBe(true)
      expect(Number.isFinite(p.y[h])).toBe(true)
      expect(p.x[h]).toBeGreaterThanOrEqual(0)
      expect(p.x[h]).toBeLessThanOrEqual(W)
      expect(p.y[h]).toBeGreaterThanOrEqual(0)
      expect(p.y[h]).toBeLessThanOrEqual(H)
    }
  })

  it('puts the households of each municipality in order: the 3 in A on the left, the 2 in B on the right', () => {
    const p = dotPositions(small, 5, W, H)
    if (p === null) throw new Error('expected positions')
    const rightOfA = Math.max(p.x[0], p.x[1], p.x[2])
    const leftOfB = Math.min(p.x[3], p.x[4])
    expect(rightOfA).toBeLessThan(leftOfB)
  })

  it('gives null when the households in the file do not match the households of the run', () => {
    expect(dotPositions(small, 4, W, H)).toBeNull()
    expect(dotPositions(small, 6, W, H)).toBeNull()
  })

  it('gives null when a municipality is not on the map', () => {
    expect(dotPositions({ map: oneShape, population }, 5, W, H)).toBeNull()
  })

  it('gives the same positions every time', () => {
    const first = dotPositions(small, 5, W, H)
    const second = dotPositions(small, 5, W, H)
    expect(first).not.toBeNull()
    expect(Array.from(first?.x ?? [])).toEqual(Array.from(second?.x ?? []))
    expect(Array.from(first?.y ?? [])).toEqual(Array.from(second?.y ?? []))
  })

  it('works with the real files: 3,797 households, all with positions', () => {
    const map = JSON.parse(readFileSync('public/data/camarines_norte_map.json', 'utf8')) as MapData
    const real = JSON.parse(readFileSync('public/data/population.json', 'utf8')) as PopulationData
    const households = real.barangays.reduce((sum, b) => sum + b.households, 0)
    expect(households).toBe(3797)
    const p = dotPositions({ map, population: real }, households, W, H)
    expect(p).not.toBeNull()
    expect(p?.x).toHaveLength(3797)
    expect(p?.y).toHaveLength(3797)
    expect(Array.from(p?.x ?? []).some((v) => Number.isNaN(v))).toBe(false)
    expect(Array.from(p?.y ?? []).some((v) => Number.isNaN(v))).toBe(false)
  })
})