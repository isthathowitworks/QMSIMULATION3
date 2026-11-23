import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MapData } from '../src/state/loadMap'
import type { MapColumns } from '../src/state/mapData'
import MapPair from '../src/ui/map/MapPair'

const real = JSON.parse(readFileSync('public/data/camarines_norte_map.json', 'utf8')) as MapData
const names = real.features.map((f) => f.properties.adm3_en)

function columns(baseline: number[], policy: number[]): MapColumns {
  return { names, baseline, policy }
}

function render(c: MapColumns): string {
  return renderToStaticMarkup(createElement(MapPair, { map: real, columns: c }))
}

function count(markup: string, piece: string): number {
  return markup.split(piece).length - 1
}

// 10 in the first municipality, 0 in the other eleven
function first(value: number): number[] {
  return names.map((_, i) => (i === 0 ? value : 0))
}

describe('MapPair', () => {
  it('draws two maps with 12 shapes each', () => {
    const markup = render(columns(first(10), first(5)))
    expect(count(markup, 'map-card')).toBe(2)
    expect(count(markup, '<path')).toBe(24)
  })

  it('shows do nothing on the left and your policy on the right', () => {
    const markup = render(columns(first(10), first(5)))
    expect(markup).toContain('>Do nothing</h3>')
    expect(markup).toContain('>Your policy</h3>')
    expect(markup.indexOf('Do nothing')).toBeLessThan(markup.indexOf('Your policy'))
  })

  it('puts both maps in one row that wraps, so they stack on a narrow screen', () => {
    const markup = render(columns(first(10), first(5)))
    expect(markup).toContain('class="map-pair"')
    expect(markup).toContain('aria-label="Maps of the municipalities"')
  })

  it('colors both maps on the same scale: half the number gives the middle color, not the darkest', () => {
    const markup = render(columns(first(10), first(5)))
    expect(count(markup, 'fill="#7f2704"')).toBe(1)
    expect(count(markup, 'fill="#fd8d3c"')).toBe(1)
    expect(count(markup, 'fill="#fff5eb"')).toBe(22)
  })

  it('shows the same top value in both legends, from the larger of the two runs', () => {
    const markup = render(columns(first(10), first(5)))
    expect(count(markup, '>10</span>')).toBe(2)
  })

  it('takes the top value from the policy map when that one is higher', () => {
    const markup = render(columns(first(5), first(20)))
    expect(count(markup, '>20</span>')).toBe(2)
    expect(count(markup, 'fill="#7f2704"')).toBe(1)
  })

  it('gives each map its own picture label', () => {
    const markup = render(columns(first(10), first(5)))
    expect(markup).toContain('with no cleaning and no fogging')
    expect(markup).toContain('with your policy')
  })

  it('has no NaN when everything is zero', () => {
    const markup = render(columns(first(0), first(0)))
    expect(markup).not.toContain('NaN')
    expect(count(markup, 'fill="#fff5eb"')).toBe(24)
  })
})