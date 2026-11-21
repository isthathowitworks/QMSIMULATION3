import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/engine/daily', () => ({
  mosquitoDay: vi.fn(() => 7),
}))

import { mosquitoDay } from '../src/engine/daily'
import { runSpinup, wrapIndex } from '../src/engine/spinup'
import { DEFAULT_PARAMS } from '../src/engine/params'

describe('wrapIndex', () => {
  it('leaves in-range days alone', () => {
    expect(wrapIndex(0, 10)).toBe(0)
    expect(wrapIndex(9, 10)).toBe(9)
  })
  it('wraps negative days to the end of the record', () => {
    expect(wrapIndex(-1, 10)).toBe(9)
    expect(wrapIndex(-10, 10)).toBe(0)
    expect(wrapIndex(-11, 10)).toBe(9)
  })
  it('wraps days past the end', () => {
    expect(wrapIndex(10, 10)).toBe(0)
    expect(wrapIndex(23, 10)).toBe(3)
  })
})

describe('runSpinup', () => {
  beforeEach(() => {
    vi.mocked(mosquitoDay).mockClear()
  })

  const t2m = Array.from({ length: 10 }, (_, i) => i)
  const rain14 = Array.from({ length: 10 }, (_, i) => i * 10)

  function run() {
    return runSpinup({} as any, new Uint8Array(1), {} as any, t2m, rain14, DEFAULT_PARAMS, {} as any)
  }

  it('runs spinupDays days and returns one cleaning count per day', () => {
    const out = run()
    expect(out.length).toBe(DEFAULT_PARAMS.spinupDays)
    expect(mosquitoDay).toHaveBeenCalledTimes(DEFAULT_PARAMS.spinupDays)
    expect(out.every((v) => v === 7)).toBe(true)
  })

  it('goes from day -spinupDays to day -1', () => {
    run()
    const calls = vi.mocked(mosquitoDay).mock.calls
    expect(calls[0][3]).toBe(-DEFAULT_PARAMS.spinupDays)
    expect(calls[calls.length - 1][3]).toBe(-1)
  })

  it('reads weather from the end of the record for negative days', () => {
    run()
    const calls = vi.mocked(mosquitoDay).mock.calls
    const last = calls[calls.length - 1]
    expect(last[4]).toBe(9) // t2m at index 9
    expect(last[5]).toBe(90) // rain14 at index 9
    const first = calls[0]
    const w = wrapIndex(-DEFAULT_PARAMS.spinupDays, 10)
    expect(first[4]).toBe(w)
    expect(first[5]).toBe(w * 10)
  })
})