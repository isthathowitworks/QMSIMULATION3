import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import ControlPanel from '../src/ui/controls/ControlPanel'
import { DEFAULT_CONTROLS, CLEANING_PRESETS } from '../src/state/policyControls'
import type { PolicyControls } from '../src/state/policyControls'

function html(controls: PolicyControls = DEFAULT_CONTROLS): string {
  return renderToString(createElement(ControlPanel, { controls, onChange: () => {} }))
}

describe('control panel', () => {
  it('shows all six presets', () => {
    const out = html()
    for (const p of CLEANING_PRESETS) expect(out).toContain(p.label)
  })

  it('shows the starting position', () => {
    const out = html()
    expect(out).toContain('Every 7 days')
    expect(out).toContain('50%')
    expect(out).toContain('1 reported case in 7 days')
  })

  it('marks exactly one preset as active', () => {
    expect(html().split('aria-pressed="true"').length - 1).toBe(1)
    expect(html({ ...DEFAULT_CONTROLS, compliance: 0.4 }).split('aria-pressed="true"').length - 1).toBe(0)
  })

  it('interval 0 reads as no cleaning', () => {
    expect(html({ ...DEFAULT_CONTROLS, cleaningInterval: 0 })).toContain('<strong>No cleaning</strong>')
  })

  it('warns when compliance is above the PHO estimate', () => {
    expect(html({ ...DEFAULT_CONTROLS, compliance: 0.75 })).toMatch(/hypothetical/)
    expect(html()).not.toMatch(/hypothetical/)
  })

  it('turns the trigger slider off when fogging is off', () => {
    expect(html()).not.toContain('disabled=""')
    expect(html({ ...DEFAULT_CONTROLS, foggingOn: false })).toContain('disabled=""')
  })

  it('says cases when the trigger is more than 1', () => {
    expect(html({ ...DEFAULT_CONTROLS, foggingTrigger: 5 })).toContain('5 reported cases in 7 days')
  })
})