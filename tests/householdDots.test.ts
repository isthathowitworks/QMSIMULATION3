import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MapData } from '../src/state/loadMap'
import HouseholdDots from '../src/ui/map/HouseholdDots'

const real = JSON.parse(readFileSync('public/data/camarines_norte_map.json', 'utf8')) as MapData

type Props = ComponentProps<typeof HouseholdDots>

// 6 households at (10, 100), (20, 110), (30, 120), (40, 130), (50, 140), (60, 150)
const positions = {
  x: Float64Array.from([10, 20, 30, 40, 50, 60]),
  y: Float64Array.from([100, 110, 120, 130, 140, 150]),
}

// 2 snapshots (weeks) of 6 households: 0 susceptible, 1 exposed, 2 infectious, 3 recovered
const baselineStates = Uint8Array.from([0, 1, 2, 3, 2, 0, /* week 1 */ 2, 2, 2, 0, 0, 0])
const policyStates = Uint8Array.from([0, 0, 0, 0, 0, 0, /* week 1 */ 1, 0, 0, 0, 0, 0])

function render(over: Partial<Props> = {}): string {
  const props: Props = {
    map: real,
    positions,
    householdCount: 6,
    baselineStates,
    policyStates,
    snapshot: 0,
    width: 400,
    height: 360,
    ...over,
  }
  return renderToStaticMarkup(createElement(HouseholdDots, props))
}

function count(markup: string, piece: string): number {
  return markup.split(piece).length - 1
}

describe('HouseholdDots', () => {
  it('shows do nothing on the left and your policy on the right', () => {
    const markup = render()
    expect(count(markup, 'map-card')).toBe(2)
    expect(markup).toContain('>Do nothing</h3>')
    expect(markup).toContain('>Your policy</h3>')
    expect(markup.indexOf('Do nothing')).toBeLessThan(markup.indexOf('Your policy'))
  })

  it('puts both in one row that wraps, like the two maps', () => {
    const markup = render()
    expect(markup).toContain('class="map-pair"')
    expect(markup).toContain('aria-label="Household dots"')
  })

  it('draws the 12 municipality outlines under the dots, in both pictures', () => {
    expect(count(render(), 'dots-shape')).toBe(24)
  })

  it('draws one dot per household in each picture, at the given positions', () => {
    const markup = render()
    expect(count(markup, 'h0')).toBe(12) // 6 households x 2 pictures
    // the infectious households of the do-nothing run in week 0 are households 2 and 4
    expect(markup).toContain('M30.0 120.0h0M50.0 140.0h0')
  })

  it('draws susceptible first and infectious last, so the infected dots are on top', () => {
    const markup = render()
    const at = (id: string) => markup.indexOf(`dots-dot-${id}`)
    expect(at('susceptible')).toBeLessThan(at('recovered'))
    expect(at('recovered')).toBeLessThan(at('exposed'))
    expect(at('exposed')).toBeLessThan(at('infectious'))
  })

  it('counts the households in each state in the legend, for week 0', () => {
    const markup = render({ snapshot: 0 })
    // do nothing: 2 infectious, 1 exposed, 1 recovered, 2 susceptible. your policy: all 6 susceptible
    expect(count(markup, '>Infectious: 2<')).toBe(1)
    expect(count(markup, '>Infectious: 0<')).toBe(1)
    expect(count(markup, '>Exposed: 1<')).toBe(1)
    expect(count(markup, '>Recovered: 1<')).toBe(1)
    expect(count(markup, '>Susceptible: 2<')).toBe(1)
    expect(count(markup, '>Susceptible: 6<')).toBe(1)
  })

  it('shows the week it is given', () => {
    const markup = render({ snapshot: 1 })
    // do nothing: 3 infectious, 3 susceptible. your policy: 1 exposed, 5 susceptible
    expect(count(markup, '>Infectious: 3<')).toBe(1)
    expect(count(markup, '>Susceptible: 3<')).toBe(1)
    expect(count(markup, '>Exposed: 1<')).toBe(1)
    expect(count(markup, '>Susceptible: 5<')).toBe(1)
    expect(count(markup, 'h0')).toBe(12) // 6 households x 2 pictures, whatever the week
  })

  it('titles the legend and says the positions are not real house locations', () => {
    const markup = render()
    expect(count(markup, '>Highest state in the household</p>')).toBe(2)
    expect(count(markup, 'not real house locations')).toBe(1)
  })

  it('shows a note and no pictures when the week is not one of the weeks', () => {
    for (const snapshot of [2, -1, 0.5]) {
      const markup = render({ snapshot })
      expect(markup).toContain('No household dots to show yet.')
      expect(markup).not.toContain('<svg')
    }
  })

  it('shows a note and no pictures when the lengths do not line up', () => {
    expect(render({ baselineStates: new Uint8Array(5) })).toContain('No household dots to show yet.')
    expect(render({ policyStates: new Uint8Array(6) })).toContain('No household dots to show yet.')
    expect(
      render({ positions: { x: new Float64Array(5), y: new Float64Array(5) } }),
    ).toContain('No household dots to show yet.')
    expect(
      render({ householdCount: 0, baselineStates: new Uint8Array(0), policyStates: new Uint8Array(0) }),
    ).toContain('No household dots to show yet.')
  })

  it('shows a note and no pictures when there are no municipality shapes', () => {
    const markup = render({ map: { type: 'FeatureCollection', features: [] } as unknown as MapData })
    expect(markup).toContain('No household dots to show yet.')
    expect(markup).not.toContain('<svg')
  })

  it('has no NaN and nothing undefined', () => {
    const markup = render()
    expect(markup).not.toContain('NaN')
    expect(markup).not.toContain('undefined')
  })
})