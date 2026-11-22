import { describe, it, expect } from 'vitest'
import { parseCheckArgs, summarize } from '../scripts/check-fit'

describe('parseCheckArgs', () => {
  it('gives defaults when nothing is passed', () => {
    expect(parseCheckArgs([])).toEqual({
      file: 'data-private/fit-round2.json',
      top: 3,
      seeds: 3,
      out: 'data-private/fit-check.json',
    })
  })

  it('reads file, top, seeds and out', () => {
    expect(parseCheckArgs(['--file', 'a.json', '--top', '5', '--seeds', '2', '--out', 'b.json'])).toEqual({
      file: 'a.json',
      top: 5,
      seeds: 2,
      out: 'b.json',
    })
  })

  it('rejects a top value that is not a whole number of 1 or more', () => {
    expect(() => parseCheckArgs(['--top', '0'])).toThrow()
    expect(() => parseCheckArgs(['--top', 'x'])).toThrow()
    expect(() => parseCheckArgs(['--top'])).toThrow()
  })

  it('rejects a seeds value that is not a whole number of 1 or more', () => {
    expect(() => parseCheckArgs(['--seeds', '2.5'])).toThrow()
  })

  it('rejects --file or --out without a path', () => {
    expect(() => parseCheckArgs(['--file'])).toThrow()
    expect(() => parseCheckArgs(['--out'])).toThrow()
  })

  it('rejects an unknown option', () => {
    expect(() => parseCheckArgs(['--speed', '3'])).toThrow(/Unknown option/)
  })
})

describe('summarize', () => {
  it('gives mean, lowest and highest total, and the means of scoreV2 and fogging rounds', () => {
    const s = summarize([
      { totalSim: 400, scoreV2: 0.2, foggingRounds: 100 },
      { totalSim: 500, scoreV2: 0.4, foggingRounds: 200 },
      { totalSim: 600, scoreV2: 0.6, foggingRounds: 300 },
    ])
    expect(s.meanSim).toBeCloseTo(500, 10)
    expect(s.minSim).toBe(400)
    expect(s.maxSim).toBe(600)
    expect(s.meanScoreV2).toBeCloseTo(0.4, 10)
    expect(s.meanFogging).toBeCloseTo(200, 10)
  })

  it('works with a single run', () => {
    const s = summarize([{ totalSim: 459, scoreV2: 0.216, foggingRounds: 150 }])
    expect(s.meanSim).toBe(459)
    expect(s.minSim).toBe(459)
    expect(s.maxSim).toBe(459)
  })

  it('throws when there are no runs', () => {
    expect(() => summarize([])).toThrow()
  })
})