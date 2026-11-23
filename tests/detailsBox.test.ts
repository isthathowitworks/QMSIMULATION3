import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MunicipalityDetails } from '../src/state/municipalities'
import DetailsBox from '../src/ui/map/DetailsBox'

function render(details: MunicipalityDetails | null): string {
  return renderToStaticMarkup(createElement(DetailsBox, { details }))
}

const daet: MunicipalityDetails = { name: 'Daet', people: 18986, infections: 1234, perThousand: 77.8765 }

describe('DetailsBox', () => {
  it('shows a hint when no municipality is chosen', () => {
    const markup = render(null)
    expect(markup).toContain('Hover over, focus or tap a municipality to see its details.')
    expect(markup).not.toContain('<dl')
  })

  it('shows the name of the municipality', () => {
    expect(render(daet)).toContain('>Daet</h4>')
  })

  it('shows the people with a thousands separator', () => {
    const markup = render(daet)
    expect(markup).toContain('>People in the simulation</dt>')
    expect(markup).toContain('>18,986</dd>')
  })

  it('shows the bite infections over the whole run', () => {
    const markup = render(daet)
    expect(markup).toContain('>Bite infections over the whole run</dt>')
    expect(markup).toContain('>1,234</dd>')
  })

  it('shows the infections per 1,000 people with at most three digits', () => {
    const markup = render(daet)
    expect(markup).toContain('>Bite infections per 1,000 people</dt>')
    expect(markup).toContain('>77.9</dd>')
  })

  it('shows 0 and no NaN for a municipality with no infections', () => {
    const markup = render({ name: 'Quiet', people: 0, infections: 0, perThousand: 0 })
    expect(markup).not.toContain('NaN')
    expect(markup).toContain('>0</dd>')
  })
})