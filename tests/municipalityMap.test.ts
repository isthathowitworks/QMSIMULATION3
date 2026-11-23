import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MapData } from '../src/state/loadMap'
import type { MunicipalityDetails } from '../src/state/municipalities'
import MunicipalityMap from '../src/ui/map/MunicipalityMap'

const real = JSON.parse(readFileSync('public/data/camarines_norte_map.json', 'utf8')) as MapData
const names = real.features.map((f) => f.properties.adm3_en)

function render(
  values: number[],
  max: number,
  shownNames: string[] = names,
  map: MapData = real,
  details?: MunicipalityDetails[],
): string {
  return renderToStaticMarkup(
    createElement(MunicipalityMap, {
      map,
      names: shownNames,
      values,
      max,
      title: 'Test map',
      svgLabel: 'Test picture',
      ...(details ? { details } : {}),
    }),
  )
}

function count(markup: string, piece: string): number {
  return markup.split(piece).length - 1
}

describe('MunicipalityMap', () => {
  it('uses the title and the picture label it is given', () => {
    const markup = render(names.map(() => 1), 1)
    expect(markup).toContain('aria-label="Test map"')
    expect(markup).toContain('aria-label="Test picture"')
    expect(markup).toContain('>Test map</h3>')
  })

  it('draws 12 shapes, one per municipality', () => {
    const markup = render(names.map(() => 1), 1)
    expect(count(markup, '<path')).toBe(12)
    for (const name of names) expect(markup).toContain(`data-municipality="${name}"`)
  })

  it('colors the shapes on one scale: top value darkest, zero lightest', () => {
    const values = names.map((_, i) => (i === 0 ? 10 : 0))
    const markup = render(values, 10)
    expect(count(markup, 'fill="#7f2704"')).toBe(1)
    expect(count(markup, 'fill="#fff5eb"')).toBe(11)
  })

  it('gives a name that is not in the list a gray shape with no color from the scale', () => {
    const markup = render([5], 10, ['Daet'])
    expect(count(markup, 'map-shape-missing')).toBe(11)
    expect(count(markup, 'fill="')).toBe(1)
  })

  it('shows 0 and the top of the scale in the legend, with at most three digits', () => {
    const markup = render(names.map(() => 1), 12.3456)
    expect(markup).toContain('>0</span>')
    expect(markup).toContain('>12.3</span>')
  })

  it('says in the legend that the numbers cover the whole run', () => {
    const markup = render(names.map(() => 1), 1)
    expect(markup).toContain('>Bite infections per 1,000 people over the whole run</p>')
  })

  it('shows a note and no map when there is nothing to draw', () => {
    const markup = render([], 1, [], { type: 'FeatureCollection', features: [] })
    expect(markup).toContain('No map to show yet.')
    expect(markup).not.toContain('<svg')
  })

  it('has no NaN when everything is zero', () => {
    const markup = render(names.map(() => 0), 0)
    expect(markup).not.toContain('NaN')
    expect(count(markup, 'fill="#fff5eb"')).toBe(12)
  })
})

describe('MunicipalityMap details (6.3b)', () => {
  const details: MunicipalityDetails[] = names.map((name, i) => ({
    name,
    people: 1000 + i,
    infections: i,
    perThousand: i * 1.5,
  }))
  const values = names.map((_, i) => i)

  it('has no focusable shapes, no buttons and no details box without details', () => {
    const markup = render(values, 11)
    expect(markup).not.toContain('tabindex')
    expect(markup).not.toContain('role="button"')
    expect(markup).not.toContain('map-details')
    expect(markup).toContain('role="img"')
  })

  it('makes all 12 shapes focusable buttons when every municipality has details', () => {
    const markup = render(values, 11, names, real, details)
    expect(count(markup, 'tabindex="0"')).toBe(12)
    expect(count(markup, 'role="button"')).toBe(12)
    expect(count(markup, 'aria-pressed="false"')).toBe(12)
  })

  it('shows the hint in the details box and chooses no shape at the start', () => {
    const markup = render(values, 11, names, real, details)
    expect(markup).toContain('Hover over, focus or tap a municipality to see its details.')
    expect(markup).not.toContain('map-shape-active')
  })

  it('changes the picture role to group so the shapes can be reached', () => {
    const markup = render(values, 11, names, real, details)
    expect(markup).toContain('role="group"')
    expect(markup).not.toContain('role="img"')
    expect(markup).toContain('aria-label="Test picture"')
  })

  it('makes only the shapes that have details focusable', () => {
    const markup = render(values, 11, names, real, [details[0]])
    expect(count(markup, 'tabindex="0"')).toBe(1)
    expect(count(markup, 'role="button"')).toBe(1)
  })

  it('labels a shape with its name and its infections per 1,000 people', () => {
    const markup = render(values, 11, names, real, details)
    expect(markup).toContain(`aria-label="${names[3]}: 4.5 bite infections per 1,000 people"`)
  })
})