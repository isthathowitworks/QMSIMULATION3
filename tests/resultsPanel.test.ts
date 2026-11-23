import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Comparison } from '../src/state/curve'
import type { MapData } from '../src/state/loadMap'
import type { PopulationData } from '../src/state/municipalities'
import type { MapDataState } from '../src/state/useMapData'
import ResultsPanel from '../src/ui/run/ResultsPanel'

// 12 households (4 in each of the three municipalities) and 2 weekly snapshots
const HOUSEHOLDS = 12

// week 0: three households infectious, the rest susceptible; week 1: everybody recovered
const baselineHouseholdStates = new Uint8Array(HOUSEHOLDS * 2)
baselineHouseholdStates.fill(2, 0, 3)
baselineHouseholdStates.fill(3, HOUSEHOLDS)

// week 0: one household infectious; week 1: everybody susceptible
const policyHouseholdStates = new Uint8Array(HOUSEHOLDS * 2)
policyHouseholdStates[0] = 2

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
  householdCount: HOUSEHOLDS,
  baselineHouseholdStates,
  policyHouseholdStates,
}

// A small fake map with three municipalities that fits the three bite numbers above.
function triangle(name: string, shift: number) {
  return {
    type: 'Feature',
    properties: { adm3_en: name },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [shift, 0],
          [shift + 1, 0],
          [shift + 1, 1],
          [shift, 0],
        ],
      ],
    },
  }
}

const fakeMap = {
  type: 'FeatureCollection',
  features: [triangle('X', 0), triangle('Y', 2), triangle('Z', 4)],
} as unknown as MapData

// 100 simulated people and a number of households in each municipality
function fakePopulation(names: string[], households = 4): PopulationData {
  return {
    barangays: names.map((municipality) => ({ municipality, simPeople: 100, households })),
  } as unknown as PopulationData
}

const ready: MapDataState = {
  status: 'ready',
  files: { map: fakeMap, population: fakePopulation(['X', 'Y', 'Z']) },
}

function render(value: Comparison | null, mapState: MapDataState = ready): string {
  return renderToStaticMarkup(createElement(ResultsPanel, { comparison: value, mapState }))
}

function count(markup: string, piece: string): number {
  return markup.split(piece).length - 1
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

describe('ResultsPanel maps', () => {
  it('shows the two maps between the infection chart and the mosquito charts', () => {
    const markup = render(comparison)
    // two maps and two household dot cards
    expect(count(markup, 'map-card')).toBe(4)
    expect(markup).toContain('>Do nothing</h3>')
    expect(markup).toContain('>Your policy</h3>')
    const infections = markup.indexOf('aria-label="Infection curve"')
    const maps = markup.indexOf('aria-label="Maps of the municipalities"')
    const adults = markup.indexOf('aria-label="Adult mosquitoes"')
    expect(maps).toBeGreaterThan(infections)
    expect(maps).toBeLessThan(adults)
  })

  it('colors both maps on one scale, from bite infections per 1,000 simulated people', () => {
    // 6, 5, 3 bites in 100 simulated people each: 60, 50 and 30 per 1,000; the top of the scale is 60
    const markup = render(comparison)
    expect(count(markup, '>60</span>')).toBe(2)
    expect(count(markup, 'fill="#7f2704"')).toBe(1)
  })

  it('shows a loading note in the map spot and keeps the charts and the headline number', () => {
    const markup = render(comparison, { status: 'loading' })
    expect(markup).toContain('Loading the map.')
    expect(count(markup, 'map-card')).toBe(0)
    expect(markup).toContain('>57%<')
    expect(markup.match(/<polyline/g)).toHaveLength(6)
  })

  it('shows why the map failed and keeps the charts and the headline number', () => {
    const markup = render(comparison, { status: 'failed', message: 'status 404' })
    expect(markup).toContain('The map could not be loaded (status 404)')
    expect(count(markup, 'map-card')).toBe(0)
    expect(markup).toContain('>57%<')
    expect(markup.match(/<polyline/g)).toHaveLength(6)
  })

  it('shows a note and no map when the run does not fit the population file', () => {
    const twoOnly: MapDataState = {
      status: 'ready',
      files: { map: fakeMap, population: fakePopulation(['X', 'Y']) },
    }
    const markup = render(comparison, twoOnly)
    expect(markup).toContain('does not match the number of municipalities')
    expect(count(markup, 'map-card')).toBe(0)
    expect(markup.match(/<polyline/g)).toHaveLength(6)
  })
})

describe('ResultsPanel household dots', () => {
  it('shows the household dots and the week slider after the maps and before the mosquito charts', () => {
    const markup = render(comparison)
    const maps = markup.indexOf('aria-label="Maps of the municipalities"')
    const dots = markup.indexOf('aria-label="Household dots"')
    const slider = markup.indexOf('aria-label="Week control"')
    const adults = markup.indexOf('aria-label="Adult mosquitoes"')
    expect(dots).toBeGreaterThan(maps)
    expect(slider).toBeGreaterThan(dots)
    expect(slider).toBeLessThan(adults)
    expect(markup).toContain('Highest state in the household')
  })

  it('starts paused on the first week', () => {
    const markup = render(comparison)
    expect(markup).toContain('>Play</button>')
    expect(markup).toContain('aria-label="Week of the run"')
  })

  it('shows no dots and no slider while the map files load or if they fail', () => {
    for (const state of [{ status: 'loading' }, { status: 'failed', message: 'status 404' }] as MapDataState[]) {
      const markup = render(comparison, state)
      expect(markup).not.toContain('aria-label="Household dots"')
      expect(markup).not.toContain('aria-label="Week control"')
    }
  })

  it('shows a note and no dots when the households in the population file do not fit the run', () => {
    // 3 municipalities with 5 households each is 15 households, the run has 12
    const wrongHouseholds: MapDataState = {
      status: 'ready',
      files: { map: fakeMap, population: fakePopulation(['X', 'Y', 'Z'], 5) },
    }
    const markup = render(comparison, wrongHouseholds)
    expect(markup).toContain('The household dots do not match this run, so they are not shown.')
    expect(markup).not.toContain('aria-label="Household dots"')
    expect(markup).not.toContain('aria-label="Week control"')
    // the maps and the charts are not affected
    expect(markup).toContain('aria-label="Maps of the municipalities"')
    expect(markup.match(/<polyline/g)).toHaveLength(6)
  })
})