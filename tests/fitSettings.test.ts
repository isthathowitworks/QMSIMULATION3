import { describe, it, expect } from 'vitest'
import { parseArgs, parseRange, paramsForTrial } from '../scripts/fit-settings'
import { DEFAULT_PARAMS } from '../src/engine/params'
import { FIT_KEYS, FIT_RANGES, latinHypercube } from '../scripts/fit-lib'

describe('parseArgs', () => {
  it('gives defaults when nothing is passed', () => {
    expect(parseArgs([])).toEqual({
      trials: 30,
      seed: 1,
      out: 'data-private/fit-results.json',
      ranges: FIT_RANGES,
    })
  })

  it('reads trials, seed and out', () => {
    expect(parseArgs(['--trials', '5', '--seed', '7', '--out', 'x.json'])).toEqual({
      trials: 5,
      seed: 7,
      out: 'x.json',
      ranges: FIT_RANGES,
    })
  })

  it('rejects a trials value that is not a whole number of 1 or more', () => {
    expect(() => parseArgs(['--trials', '0'])).toThrow()
    expect(() => parseArgs(['--trials', 'abc'])).toThrow()
    expect(() => parseArgs(['--trials', '2.5'])).toThrow()
    expect(() => parseArgs(['--trials'])).toThrow()
  })

  it('rejects a seed that is not a whole number of 1 or more', () => {
    expect(() => parseArgs(['--seed', '-3'])).toThrow()
  })

  it('rejects --out without a path', () => {
    expect(() => parseArgs(['--out'])).toThrow()
  })

  it('rejects an unknown option', () => {
    expect(() => parseArgs(['--speed', '3'])).toThrow(/Unknown option/)
  })

  it('changes only the ranges that are named', () => {
    const args = parseArgs(['--range', 'reportFrac=0.005:0.15'])
    expect(args.ranges.reportFrac).toEqual([0.005, 0.15])
    expect(args.ranges.biteRate).toEqual(FIT_RANGES.biteRate)
    expect(args.ranges.kPerPerson).toEqual(FIT_RANGES.kPerPerson)
    expect(args.ranges.importedSurgeSize).toEqual(FIT_RANGES.importedSurgeSize)
  })

  it('accepts --range more than once', () => {
    const args = parseArgs(['--range', 'biteRate=0.1:0.3', '--range', 'kPerPerson=0.5:3'])
    expect(args.ranges.biteRate).toEqual([0.1, 0.3])
    expect(args.ranges.kPerPerson).toEqual([0.5, 3])
  })

  it('does not change FIT_RANGES', () => {
    const before = JSON.stringify(FIT_RANGES)
    parseArgs(['--range', 'reportFrac=0.005:0.15'])
    expect(JSON.stringify(FIT_RANGES)).toBe(before)
  })

  it('rejects --range without a value', () => {
    expect(() => parseArgs(['--range'])).toThrow()
  })
})

describe('parseRange', () => {
  it('reads key=low:high', () => {
    expect(parseRange('reportFrac=0.005:0.15')).toEqual({ key: 'reportFrac', range: [0.005, 0.15] })
  })

  it('allows a low end of 0', () => {
    expect(parseRange('importedSurgeSize=0:40')).toEqual({ key: 'importedSurgeSize', range: [0, 40] })
  })

  it('rejects an unknown setting', () => {
    expect(() => parseRange('speed=1:2')).toThrow(/Unknown setting/)
  })

  it('rejects a missing equals sign or colon', () => {
    expect(() => parseRange('reportFrac')).toThrow()
    expect(() => parseRange('reportFrac=0.1')).toThrow()
    expect(() => parseRange('=0.1:0.2')).toThrow()
  })

  it('rejects empty or non-number ends', () => {
    expect(() => parseRange('reportFrac=:0.2')).toThrow()
    expect(() => parseRange('reportFrac=0.1:')).toThrow()
    expect(() => parseRange('reportFrac=a:b')).toThrow()
  })

  it('rejects a low end that is not below the high end', () => {
    expect(() => parseRange('reportFrac=0.2:0.1')).toThrow(/below/)
    expect(() => parseRange('reportFrac=0.1:0.1')).toThrow(/below/)
  })
})

describe('paramsForTrial', () => {
  it('lays the four fitted settings over the starting positions', () => {
    const settings = { biteRate: 0.2, kPerPerson: 1.1, reportFrac: 0.1, importedSurgeSize: 12 }
    const p = paramsForTrial(settings)
    expect(p.biteRate).toBe(0.2)
    expect(p.kPerPerson).toBe(1.1)
    expect(p.reportFrac).toBe(0.1)
    expect(p.importedSurgeSize).toBe(12)
  })

  it('leaves every other setting at its starting position', () => {
    const p = paramsForTrial(latinHypercube(1, 1)[0])
    const fitted = new Set<string>(FIT_KEYS)
    for (const key of Object.keys(DEFAULT_PARAMS) as (keyof typeof DEFAULT_PARAMS)[]) {
      if (!fitted.has(key)) expect(p[key]).toBe(DEFAULT_PARAMS[key])
    }
  })

  it('does not change DEFAULT_PARAMS', () => {
    const before = { ...DEFAULT_PARAMS }
    paramsForTrial({ biteRate: 0.2, kPerPerson: 1.1, reportFrac: 0.1, importedSurgeSize: 12 })
    expect(DEFAULT_PARAMS).toEqual(before)
  })

  it('keeps Latin hypercube values inside the search ranges', () => {
    for (const s of latinHypercube(10, 3)) {
      const p = paramsForTrial(s)
      for (const key of FIT_KEYS) {
        expect(p[key]).toBeGreaterThanOrEqual(FIT_RANGES[key][0])
        expect(p[key]).toBeLessThanOrEqual(FIT_RANGES[key][1])
      }
    }
  })
})