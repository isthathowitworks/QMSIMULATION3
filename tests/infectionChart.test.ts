import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import InfectionChart from '../src/ui/run/InfectionChart'

function render(baselineWeekly: number[], policyWeekly: number[]): string {
  return renderToStaticMarkup(createElement(InfectionChart, { baselineWeekly, policyWeekly }))
}

// the points of one line, as [x, y] pairs
function line(markup: string, className: string): number[][] {
  const tag = markup.match(new RegExp(`<polyline[^>]*${className}[^>]*>`))
  if (!tag) throw new Error(`no line with class ${className}`)
  const points = tag[0].match(/points="([^"]*)"/)
  if (!points) throw new Error('no points')
  return points[1].split(' ').map((p) => p.split(',').map(Number))
}

describe('InfectionChart', () => {
  it('shows a note and no chart when there is nothing to draw', () => {
    const markup = render([], [])
    expect(markup).toContain('No curve to show yet.')
    expect(markup).not.toContain('<svg')
  })

  it('draws two lines with one point per week', () => {
    const markup = render([1, 5, 3], [0, 2, 1])
    expect(line(markup, 'chart-line-baseline')).toHaveLength(3)
    expect(line(markup, 'chart-line-policy')).toHaveLength(3)
  })

  it('rounds the top of the axis up to an easy number', () => {
    const small = render([0, 3, 1], [0, 1, 0])
    expect(small).toContain('>4</text>')
    expect(small).toContain('>2</text>')
    const big = render([45, 10], [20, 5])
    expect(big).toContain('>60</text>')
    expect(big).toContain('>30</text>')
  })

  it('draws a lower curve lower down: a policy of zeros lies below the baseline peak', () => {
    const markup = render([0, 10, 0], [0, 0, 0])
    const policy = line(markup, 'chart-line-policy')
    const baseline = line(markup, 'chart-line-baseline')
    expect(new Set(policy.map((p) => p[1])).size).toBe(1)
    expect(baseline[1][1]).toBeLessThan(policy[1][1])
  })

  it('handles all zeros without NaN, with an axis from 0 to 1', () => {
    const markup = render([0, 0], [0, 0])
    expect(markup).not.toContain('NaN')
    expect(markup).toContain('>1</text>')
  })

  it('handles a single week without NaN', () => {
    const markup = render([4], [2])
    expect(markup).not.toContain('NaN')
    expect(line(markup, 'chart-line-baseline')).toHaveLength(1)
  })

  it('treats values that are not numbers as zero', () => {
    const markup = render([Number.NaN, 2], [1, Number.POSITIVE_INFINITY])
    expect(markup).not.toContain('NaN')
    expect(markup).not.toContain('Infinity')
  })

  it('labels the weeks every 52 weeks', () => {
    const weeks = Array.from({ length: 120 }, () => 1)
    const markup = render(weeks, weeks)
    expect(markup).toContain('>52</text>')
    expect(markup).toContain('>104</text>')
    expect(markup).not.toContain('>156</text>')
  })

  it('has a text label for screen readers and a legend for both lines', () => {
    const markup = render([1, 2], [1, 1])
    expect(markup).toContain('role="img"')
    expect(markup).toContain('Weekly infections')
    expect(markup).toContain('Do nothing')
    expect(markup).toContain('Your policy')
  })
})