import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Comparison } from '../src/state/curve'
import ResultsPanel from '../src/ui/run/ResultsPanel'

const comparison: Comparison = {
  baselineWeekly: [4, 8, 2],
  policyWeekly: [2, 3, 1],
  baselineTotal: 14,
  policyTotal: 6,
  percentReduction: (8 / 14) * 100,
}

function render(value: Comparison | null): string {
  return renderToStaticMarkup(createElement(ResultsPanel, { comparison: value }))
}

describe('ResultsPanel', () => {
  it('shows nothing when there is no comparison', () => {
    expect(render(null)).toBe('')
  })

  it('shows the infection chart when there is a comparison', () => {
    const markup = render(comparison)
    expect(markup).toContain('aria-label="Results"')
    expect(markup).toContain('aria-label="Infection curve"')
    expect(markup).toContain('<svg')
  })

  it('draws both weekly curves, the baseline and the policy', () => {
    const markup = render(comparison)
    expect(markup.match(/<polyline/g)).toHaveLength(2)
    expect(markup).toContain('chart-line-baseline')
    expect(markup).toContain('chart-line-policy')
  })
})