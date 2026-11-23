import { describe, it, expect } from 'vitest'
import { buildRunInput } from '../src/state/runInput'
import { DEFAULT_CONTROLS } from '../src/state/policyControls'
import { DEFAULT_PARAMS } from '../src/engine/params'

describe('buildRunInput', () => {
  it('passes the policy controls on', () => {
    const input = buildRunInput(
      { ...DEFAULT_CONTROLS, cleaningInterval: 3, foggingOn: false, foggingTrigger: 5 },
      DEFAULT_PARAMS,
      42,
    )
    expect(input.seed).toBe(42)
    expect(input.cleaningIntervalDays).toBe(3)
    expect(input.foggingOn).toBe(false)
    expect(input.foggingTrigger).toBe(5)
  })

  it('the compliance slider replaces the base compliance, everything else stays', () => {
    const input = buildRunInput({ ...DEFAULT_CONTROLS, compliance: 0.26 }, DEFAULT_PARAMS, 1)
    expect(input.params.compliance).toBe(0.26)
    expect(input.params).toEqual({ ...DEFAULT_PARAMS, compliance: 0.26 })
  })

  it('no cleaning is interval 0', () => {
    const input = buildRunInput({ ...DEFAULT_CONTROLS, cleaningInterval: 0, compliance: 0 }, DEFAULT_PARAMS, 1)
    expect(input.cleaningIntervalDays).toBe(0)
    expect(input.params.compliance).toBe(0)
  })

  it('does not change the base settings', () => {
    const base = { ...DEFAULT_PARAMS }
    buildRunInput({ ...DEFAULT_CONTROLS, compliance: 0.9 }, base, 1)
    expect(base).toEqual(DEFAULT_PARAMS)
  })
})