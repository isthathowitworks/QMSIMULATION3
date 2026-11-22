import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CONTROLS,
  CLEANING_PRESETS,
  MAX_RUNS,
  applyPreset,
  clampControls,
  matchingPreset,
} from '../src/state/policyControls'

describe('policy controls', () => {
  it('the starting position is inside every range', () => {
    expect(clampControls(DEFAULT_CONTROLS)).toEqual(DEFAULT_CONTROLS)
  })

  it('has the six presets from the plan', () => {
    expect(CLEANING_PRESETS.map((p) => p.label)).toEqual([
      'No cleaning',
      'Weekly, low compliance',
      'Weekly, moderate compliance',
      'Weekly, high compliance',
      'Frequent',
      'Infrequent',
    ])
  })

  it('a preset changes interval and compliance only', () => {
    const start = { ...DEFAULT_CONTROLS, foggingOn: false, foggingTrigger: 5, runs: 3 }
    const frequent = CLEANING_PRESETS.find((p) => p.id === 'frequent')!
    const next = applyPreset(start, frequent)
    expect(next.cleaningInterval).toBe(3)
    expect(next.compliance).toBe(0.5)
    expect(next.foggingOn).toBe(false)
    expect(next.foggingTrigger).toBe(5)
    expect(next.runs).toBe(3)
  })

  it('the no cleaning preset means interval 0 and compliance 0', () => {
    const none = CLEANING_PRESETS.find((p) => p.id === 'none')!
    const next = applyPreset(DEFAULT_CONTROLS, none)
    expect(next.cleaningInterval).toBe(0)
    expect(next.compliance).toBe(0)
  })

  it('clamps values to their ranges', () => {
    const c = clampControls({
      cleaningInterval: 99,
      compliance: 1.7,
      foggingOn: true,
      foggingTrigger: 0,
      runs: 500,
    })
    expect(c.cleaningInterval).toBe(30)
    expect(c.compliance).toBe(1)
    expect(c.foggingTrigger).toBe(1)
    expect(c.runs).toBe(MAX_RUNS)
    expect(clampControls({ ...DEFAULT_CONTROLS, cleaningInterval: -4, compliance: -1 })).toMatchObject({
      cleaningInterval: 0,
      compliance: 0,
    })
  })

  it('rounds whole-number controls and replaces bad values', () => {
    const c = clampControls({
      cleaningInterval: 6.6,
      compliance: Number.NaN,
      foggingOn: true,
      foggingTrigger: Number.NaN,
      runs: 2.4,
    })
    expect(c.cleaningInterval).toBe(7)
    expect(c.compliance).toBe(DEFAULT_CONTROLS.compliance)
    expect(c.foggingTrigger).toBe(DEFAULT_CONTROLS.foggingTrigger)
    expect(c.runs).toBe(2)
  })

  it('finds the preset that matches the controls', () => {
    expect(matchingPreset(DEFAULT_CONTROLS)?.id).toBe('weekly-moderate')
    expect(matchingPreset({ ...DEFAULT_CONTROLS, compliance: 0.4 })).toBeNull()
  })
})