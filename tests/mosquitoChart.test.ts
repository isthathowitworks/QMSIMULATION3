import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MosquitoChart from '../src/ui/run/MosquitoChart'

function render(kind: 'adults' | 'immatures', baselineWeekly: number[], policyWeekly: number[]): string {
  return renderToStaticMarkup(createElement(MosquitoChart, { kind, baselineWeekly, policyWeekly }))
}

describe('MosquitoChart', () => {
  it('labels the adults chart', () => {
    const markup = render('adults', [7, 8], [3, 4])
    expect(markup).toContain('aria-label="Adult mosquitoes"')
    expect(markup).toContain('Adult mosquitoes per person, weekly average')
    expect(markup).toContain('>Adult mosquitoes per person</text>')
  })

  it('labels the immatures chart', () => {
    const markup = render('immatures', [14, 16], [6, 8])
    expect(markup).toContain('aria-label="Immature mosquitoes"')
    expect(markup).toContain('Immature mosquitoes per person, weekly average')
    expect(markup).toContain('>Immature mosquitoes per person</text>')
  })

  it('does not mix up the two kinds', () => {
    expect(render('adults', [1], [1])).not.toContain('Immature')
    expect(render('immatures', [1], [1])).not.toContain('Adult')
  })

  it('draws both lines and the legend', () => {
    const markup = render('adults', [7, 8, 9], [3, 4, 5])
    expect(markup).toContain('chart-line-baseline')
    expect(markup).toContain('chart-line-policy')
    expect(markup).toContain('Do nothing')
    expect(markup).toContain('Your policy')
  })

  it('shows a note when there are no weeks', () => {
    const markup = render('adults', [], [])
    expect(markup).toContain('No curve to show yet.')
  })
})