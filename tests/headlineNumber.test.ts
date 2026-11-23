import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import HeadlineNumber from '../src/ui/run/HeadlineNumber'

function render(percentReduction: number | null): string {
  return renderToStaticMarkup(createElement(HeadlineNumber, { percentReduction }))
}

describe('HeadlineNumber', () => {
  it('shows the percentage and "fewer infections" when the policy helps', () => {
    const markup = render(58.2)
    expect(markup).toContain('headline-fewer')
    expect(markup).toContain('>58%<')
    expect(markup).toContain('fewer infections than doing nothing')
  })

  it('shows "more infections" when the policy is worse than doing nothing', () => {
    const markup = render(-25)
    expect(markup).toContain('headline-more')
    expect(markup).toContain('>25%<')
    expect(markup).toContain('more infections than doing nothing')
  })

  it('shows "no clear difference" when the change rounds to zero', () => {
    const markup = render(0.2)
    expect(markup).toContain('headline-same')
    expect(markup).toContain('>0%<')
    expect(markup).toContain('No clear difference')
  })

  it('shows n/a and the reason when there is nothing to compare with', () => {
    const markup = render(null)
    expect(markup).toContain('headline-unknown')
    expect(markup).toContain('>n/a<')
    expect(markup).toContain('nothing to compare')
  })
})