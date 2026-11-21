import { describe, it, expect } from 'vitest'
import { createRng } from '../src/engine/rng'
import { makeCleaningOffsets, pickCleaning } from '../src/engine/schedule'

describe('makeCleaningOffsets', () => {
  it('gives each household an offset from 0 to interval - 1', () => {
    const rng = createRng(1)
    const intervals = new Int32Array(2000).fill(7)
    const offsets = makeCleaningOffsets(intervals, rng)
    for (const o of offsets) {
      expect(Number.isInteger(o)).toBe(true)
      expect(o).toBeGreaterThanOrEqual(0)
      expect(o).toBeLessThanOrEqual(6)
    }
  })

  it('uses every offset from 0 to 6 for an interval of 7', () => {
    const rng = createRng(2)
    const offsets = makeCleaningOffsets(new Int32Array(2000).fill(7), rng)
    expect(new Set(offsets).size).toBe(7)
  })

  it('gives offset 0 when the interval is 0 or less', () => {
    const rng = createRng(3)
    const offsets = makeCleaningOffsets(new Int32Array([0, -1, 0]), rng)
    expect(Array.from(offsets)).toEqual([0, 0, 0])
  })

  it('gives the same offsets for the same seed', () => {
    const intervals = new Int32Array(500).fill(14)
    const a = makeCleaningOffsets(intervals, createRng(9))
    const b = makeCleaningOffsets(intervals, createRng(9))
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})

describe('pickCleaning', () => {
  const H = 3000

  it('with full compliance, every household cleans once per interval', () => {
    const rng = createRng(4)
    const intervals = new Int32Array(H).fill(7)
    const offsets = makeCleaningOffsets(intervals, rng)
    const compliance = new Float64Array(H).fill(1)
    const out = new Uint8Array(H)
    const timesCleaned = new Int32Array(H)
    for (let day = 0; day < 7; day++) {
      pickCleaning(day, intervals, offsets, compliance, rng, out)
      for (let h = 0; h < H; h++) timesCleaned[h] += out[h]
    }
    for (const n of timesCleaned) expect(n).toBe(1)
  })

  it('with 0 compliance, nobody cleans', () => {
    const rng = createRng(5)
    const intervals = new Int32Array(H).fill(7)
    const offsets = makeCleaningOffsets(intervals, rng)
    const compliance = new Float64Array(H).fill(0)
    const out = new Uint8Array(H)
    for (let day = 0; day < 14; day++) {
      expect(pickCleaning(day, intervals, offsets, compliance, rng, out)).toBe(0)
    }
  })

  it('with 50% compliance, about half of the due households clean', () => {
    const rng = createRng(6)
    const intervals = new Int32Array(H).fill(1)
    const offsets = makeCleaningOffsets(intervals, rng)
    const compliance = new Float64Array(H).fill(0.5)
    const out = new Uint8Array(H)
    const count = pickCleaning(0, intervals, offsets, compliance, rng, out)
    expect(count).toBeGreaterThan(H * 0.45)
    expect(count).toBeLessThan(H * 0.55)
  })

  it('returns the same number as the ones in out', () => {
    const rng = createRng(7)
    const intervals = new Int32Array(H).fill(3)
    const offsets = makeCleaningOffsets(intervals, rng)
    const compliance = new Float64Array(H).fill(0.6)
    const out = new Uint8Array(H)
    const count = pickCleaning(5, intervals, offsets, compliance, rng, out)
    let ones = 0
    for (const v of out) ones += v
    expect(count).toBe(ones)
  })

  it('works on negative days (spin-up)', () => {
    const rng = createRng(8)
    const intervals = new Int32Array(H).fill(7)
    const offsets = makeCleaningOffsets(intervals, rng)
    const compliance = new Float64Array(H).fill(1)
    const out = new Uint8Array(H)
    const timesCleaned = new Int32Array(H)
    for (let day = -150; day < -143; day++) {
      pickCleaning(day, intervals, offsets, compliance, rng, out)
      for (let h = 0; h < H; h++) timesCleaned[h] += out[h]
    }
    for (const n of timesCleaned) expect(n).toBe(1)
  })

  it('never cleans a household whose interval is 0', () => {
    const rng = createRng(10)
    const intervals = new Int32Array(10).fill(0)
    const offsets = makeCleaningOffsets(intervals, rng)
    const compliance = new Float64Array(10).fill(1)
    const out = new Uint8Array(10)
    expect(pickCleaning(0, intervals, offsets, compliance, rng, out)).toBe(0)
  })
})