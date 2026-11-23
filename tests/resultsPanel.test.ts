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
  baselineAdultsPerPerson: [6, 8, 7],
  policyAdultsPerPerson: [5, 4, 3],
  baselineImmaturesPerPerson: [20, 30, 25],
  policyImmaturesPerPerson: [15, 10, 8],
  baselineBitesByMunicipality: [6, 5, 3],
  policyBitesByMunicipality: [3, 2, 1],
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

  it('draws a baseline and a policy curve in each of the three charts', () => {
    const markup = render(comparison)
    expect(markup.match(/<polyline/g)).toHaveLength(6)
    expect(markup.match(/chart-line-baseline/g)).toHaveLength(3)
    expect(markup.match(/chart-line-policy/g)).toHaveLength(3)
  })

  it('shows the headline number above the charts', () => {
    const markup = render(comparison)
    expect(markup).toContain('>57%<')
    expect(markup).toContain('fewer infections than doing nothing')
    expect(markup.indexOf('headline-number')).toBeLessThan(markup.indexOf('<svg'))
  })

  it('shows n/a instead of a number when there is nothing to compare with', () => {
    const markup = render({ ...comparison, percentReduction: null })
    expect(markup).toContain('>n/a<')
    expect(markup).toContain('<svg')
  })

  it('shows the adult and immature mosquito charts after the infection chart', () => {
    const markup = render(comparison)
    const infections = markup.indexOf('aria-label="Infection curve"')
    const adults = markup.indexOf('aria-label="Adult mosquitoes"')
    const immatures = markup.indexOf('aria-label="Immature mosquitoes"')
    expect(infections).toBeGreaterThan(-1)
    expect(adults).toBeGreaterThan(infections)
    expect(immatures).toBeGreaterThan(adults)
  })

  it('gives each mosquito chart its own numbers', () => {
    const markup = render(comparison)
    // the immature chart peaks at 30, so its axis top is 40; no other chart gets that high
    expect(markup).toContain('>40</text>')
    expect(markup).toContain('>Adult mosquitoes per person</text>')
    expect(markup).toContain('>Immature mosquitoes per person</text>')
  })

  it('shows the note about reading the reduction with care, under the charts', () => {
    const markup = render(comparison)
    const note = markup.indexOf('results-note-after-run')
    expect(note).toBeGreaterThan(markup.indexOf('aria-label="Immature mosquitoes"'))
    expect(markup).toContain('read the size of the reduction with care')
  })

  it('does not show the always-visible note (that one is on the page itself)', () => {
    expect(render(comparison)).not.toContain('results-note-always')
  })
})