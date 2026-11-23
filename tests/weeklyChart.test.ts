import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import WeeklyChart from '../src/ui/run/WeeklyChart'

function render(baselineWeekly: number[], policyWeekly: number[]): string {
  return renderToStaticMarkup(
    createElement(WeeklyChart, {
      baselineWeekly,
      policyWeekly,
      sectionLabel: 'Test section',
      svgLabel: 'Test picture',
      yTitle: 'Test axis title',
    }),
  )
}

describe('WeeklyChart', () => {
  it('uses the labels it is given', () => {
    const markup = render([1, 2], [1, 1])
    expect(markup).toContain('aria-label="Test section"')
    expect(markup).toContain('aria-label="Test picture"')
    expect(markup).toContain('>Test axis title</text>')
    expect(markup).toContain('Do nothing')
    expect(markup).toContain('Your policy')
  })

  it('shows a note and no chart when there is nothing to draw', () => {
    const markup = render([], [])
    expect(markup).toContain('No curve to show yet.')
    expect(markup).not.toContain('<svg')
  })

  it('keeps decimals on the top label when the axis top is below 1', () => {
    const markup = render([0.3], [0.1])
    expect(markup).toContain('>0.4</text>')
    expect(markup).toContain('>0</text>')
  })

  it('has only 0 and the top when the axis top is below 2', () => {
    const markup = render([0.9], [0.2])
    expect(markup).toContain('>1</text>')
    expect(markup).not.toContain('>0.5</text>')
  })

  it('shows no floating point noise in the labels', () => {
    const markup = render([0.5], [0.2])
    expect(markup).toContain('>0.6</text>')
    expect(markup).not.toContain('0000')
  })

  it('shows whole numbers without a decimal point', () => {
    const markup = render([7.28], [2.54])
    expect(markup).toContain('>8</text>')
    expect(markup).toContain('>4</text>')
    expect(markup).not.toContain('>8.0')
  })

  it('handles mosquito-sized numbers: top of the axis 20 for 10.99', () => {
    const markup = render([10.99, 5], [2.54, 3])
    expect(markup).toContain('>20</text>')
    expect(markup).toContain('>10</text>')
  })

  it('has no NaN for all zeros', () => {
    const markup = render([0, 0], [0, 0])
    expect(markup).not.toContain('NaN')
  })
})