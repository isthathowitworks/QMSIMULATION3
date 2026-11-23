import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MunicipalityHouseholds } from '../src/state/householdCounts'
import HouseholdDetailsBox from '../src/ui/map/HouseholdDetailsBox'

function render(counts: MunicipalityHouseholds | null): string {
  return renderToStaticMarkup(createElement(HouseholdDetailsBox, { counts }))
}

const daet: MunicipalityHouseholds = {
  name: 'Daet',
  households: 1234,
  susceptible: 1000,
  exposed: 20,
  infectious: 14,
  recovered: 200,
}

describe('HouseholdDetailsBox', () => {
  it('shows a hint when no municipality is chosen', () => {
    const markup = render(null)
    expect(markup).toContain('Hover over, focus or tap a municipality to see its households.')
    expect(markup).not.toContain('<dl')
  })

  it('shows the name of the municipality', () => {
    expect(render(daet)).toContain('>Daet</h4>')
  })

  it('shows the households with a thousands separator', () => {
    const markup = render(daet)
    expect(markup).toContain('>Households</dt>')
    expect(markup).toContain('>1,234</dd>')
  })

  it('shows the households in each of the four states', () => {
    const markup = render(daet)
    expect(markup).toContain('>Susceptible</dt>')
    expect(markup).toContain('>1,000</dd>')
    expect(markup).toContain('>Exposed</dt>')
    expect(markup).toContain('>20</dd>')
    expect(markup).toContain('>Infectious</dt>')
    expect(markup).toContain('>14</dd>')
    expect(markup).toContain('>Recovered</dt>')
    expect(markup).toContain('>200</dd>')
  })

  it('lists the states in the order households, susceptible, exposed, infectious, recovered', () => {
    const markup = render(daet)
    const at = (label: string) => markup.indexOf(`>${label}</dt>`)
    expect(at('Households')).toBeLessThan(at('Susceptible'))
    expect(at('Susceptible')).toBeLessThan(at('Exposed'))
    expect(at('Exposed')).toBeLessThan(at('Infectious'))
    expect(at('Infectious')).toBeLessThan(at('Recovered'))
  })

  it('shows 0 and no NaN for a municipality with no households', () => {
    const markup = render({ name: 'Quiet', households: 0, susceptible: 0, exposed: 0, infectious: 0, recovered: 0 })
    expect(markup).not.toContain('NaN')
    expect(markup.split('>0</dd>').length - 1).toBe(5)
  })
})