import { describe, it, expect } from 'vitest'
import { createRng } from '../src/engine/rng'
import { buildWorld, INFECTIOUS } from '../src/engine/population'
import type { World, BarangayInput } from '../src/engine/population'
import { DEFAULT_PARAMS } from '../src/engine/params'
import { haversineKm, createMovement, placePeople } from '../src/engine/movement'
import type { Centroids } from '../src/engine/movement'

const centroids: Centroids = {
  A: { lat: 14.0, lon: 122.0 },
  B: { lat: 14.1, lon: 122.0 }, // close to A
  C: { lat: 14.5, lon: 123.0 }, // far from A
}

function bgy(municipality: string, name: string, households: number): BarangayInput {
  return { municipality, barangay: name, population: households * 50, simPeople: households * 5, households }
}

function build(barangays: BarangayInput[]): World {
  return buildWorld({ peoplePerSimPerson: 10, peoplePerHousehold: 5, barangays })
}

// 3 municipalities, 20 households each, 5 people per household (300 people).
const small = () => build([bgy('A', 'a1', 20), bgy('B', 'b1', 20), bgy('C', 'c1', 20)])

function arrays(w: World) {
  return {
    loc: new Int32Array(w.personState.length),
    present: new Int32Array(w.householdSize.length),
    inf: new Int32Array(w.householdSize.length),
  }
}

describe('haversineKm', () => {
  it('one degree of latitude is about 111 km', () => {
    expect(haversineKm(14, 122, 15, 122)).toBeGreaterThan(110.7)
    expect(haversineKm(14, 122, 15, 122)).toBeLessThan(111.7)
  })

  it('the same point is 0 km away', () => {
    expect(haversineKm(14.2, 122.9, 14.2, 122.9)).toBe(0)
  })
})

describe('createMovement', () => {
  it('each row sums to 1 and nobody travels to their own municipality', () => {
    const mv = createMovement(small(), centroids, 1.5)
    for (let i = 0; i < 3; i++) {
      let sum = 0
      for (let j = 0; j < 3; j++) sum += mv.gravity[i * 3 + j]
      expect(sum).toBeCloseTo(1, 10)
      expect(mv.gravity[i * 3 + i]).toBe(0)
    }
  })

  it('a nearer municipality gets more trips than a far one of the same size', () => {
    const mv = createMovement(small(), centroids, 1.5)
    expect(mv.gravity[0 * 3 + 1]).toBeGreaterThan(mv.gravity[0 * 3 + 2]) // from A: B beats C
  })

  it('a bigger distance decay sends even more trips to the near municipality', () => {
    const w = small()
    const weak = createMovement(w, centroids, 1)
    const strong = createMovement(w, centroids, 3)
    expect(strong.gravity[1]).toBeGreaterThan(weak.gravity[1])
  })

  it('a single municipality sends its trips to itself', () => {
    const mv = createMovement(build([bgy('A', 'a1', 10)]), centroids, 1.5)
    expect(mv.gravity[0]).toBe(1)
    expect(mv.gravityCum[0]).toBe(1)
  })

  it('throws when a municipality has no centroid', () => {
    expect(() => createMovement(small(), { A: centroids.A, B: centroids.B }, 1.5)).toThrow()
  })

  it('lists the households of each municipality, even when barangays are not in order', () => {
    const w = build([bgy('A', 'a1', 3), bgy('B', 'b1', 4), bgy('A', 'a2', 2)])
    const mv = createMovement(w, centroids, 1.5)
    expect(Array.from(mv.munStart)).toEqual([0, 5, 9])
    for (let m = 0; m < 2; m++) {
      for (let k = mv.munStart[m]; k < mv.munStart[m + 1]; k++) {
        expect(w.householdMunicipality[mv.munHouseholds[k]]).toBe(m)
      }
    }
  })
})

describe('placePeople', () => {
  it('with nobody away, everyone is at home', () => {
    const w = small()
    const mv = createMovement(w, centroids, 1.5)
    const { loc, present, inf } = arrays(w)
    placePeople(w, mv, { ...DEFAULT_PARAMS, pAway: 0 }, createRng(1), loc, present, inf)
    expect(Array.from(loc)).toEqual(Array.from(w.personHousehold))
    expect(Array.from(present)).toEqual(Array.from(w.householdSize))
  })

  it('with everyone away but no trips out, people stay inside their own municipality', () => {
    const w = small()
    const mv = createMovement(w, centroids, 1.5)
    const { loc, present, inf } = arrays(w)
    placePeople(w, mv, { ...DEFAULT_PARAMS, pAway: 1, pOtherMuni: 0 }, createRng(2), loc, present, inf)
    let moved = 0
    for (let p = 0; p < loc.length; p++) {
      expect(w.householdMunicipality[loc[p]]).toBe(w.householdMunicipality[w.personHousehold[p]])
      if (loc[p] !== w.personHousehold[p]) moved++
    }
    expect(moved).toBeGreaterThan(200) // most people land in a different household
  })

  it('with everyone away and every trip out, nobody stays in their own municipality', () => {
    const w = small()
    const mv = createMovement(w, centroids, 1.5)
    const { loc, present, inf } = arrays(w)
    placePeople(w, mv, { ...DEFAULT_PARAMS, pAway: 1, pOtherMuni: 1 }, createRng(3), loc, present, inf)
    for (let p = 0; p < loc.length; p++) {
      expect(w.householdMunicipality[loc[p]]).not.toBe(w.householdMunicipality[w.personHousehold[p]])
    }
  })

  it('about pAway of people are away, and about pOtherMuni of those leave their municipality', () => {
    const w = build([bgy('A', 'a1', 200), bgy('B', 'b1', 200)]) // 2000 people
    const c: Centroids = { A: centroids.A, B: centroids.B }
    const mv = createMovement(w, c, 1.5)
    const { loc, present, inf } = arrays(w)
    const rng = createRng(4)
    let away = 0
    let other = 0
    let total = 0
    for (let day = 0; day < 20; day++) {
      placePeople(w, mv, DEFAULT_PARAMS, rng, loc, present, inf)
      for (let p = 0; p < loc.length; p++) {
        total++
        if (loc[p] !== w.personHousehold[p]) away++
        if (w.householdMunicipality[loc[p]] !== w.householdMunicipality[w.personHousehold[p]]) other++
      }
    }
    expect(away / total).toBeGreaterThan(0.27)
    expect(away / total).toBeLessThan(0.33)
    expect(other / away).toBeGreaterThan(0.07)
    expect(other / away).toBeLessThan(0.13)
  })

  it('keeps the counts consistent: everyone is somewhere, and infectious people are counted where they are', () => {
    const w = small()
    for (let p = 0; p < 50; p++) w.personState[p] = INFECTIOUS
    const mv = createMovement(w, centroids, 1.5)
    const { loc, present, inf } = arrays(w)
    placePeople(w, mv, DEFAULT_PARAMS, createRng(5), loc, present, inf)
    expect(present.reduce((a, b) => a + b, 0)).toBe(300)
    expect(inf.reduce((a, b) => a + b, 0)).toBe(50)
    const check = new Int32Array(w.householdSize.length)
    for (let p = 0; p < 50; p++) check[loc[p]]++
    expect(Array.from(inf)).toEqual(Array.from(check))
  })

  it('same seed gives the same places', () => {
    const run = (seed: number) => {
      const w = small()
      const mv = createMovement(w, centroids, 1.5)
      const { loc, present, inf } = arrays(w)
      placePeople(w, mv, DEFAULT_PARAMS, createRng(seed), loc, present, inf)
      return Array.from(loc)
    }
    expect(run(6)).toEqual(run(6))
  })
})