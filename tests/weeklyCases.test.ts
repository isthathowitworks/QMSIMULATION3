import { describe, expect, it } from 'vitest'
import {
  buildWeeklyCases,
  loadBarangayCases,
  loadNameMap,
  type CaseRow,
  type NameMapRow,
} from '../scripts/prepare-lib'

const nameMap: NameMapRow[] = [
  { municipality: 'Daet', barangayPopulation: 'Alpha', barangayCaseRecord: 'Alpha', matchType: 'exact' },
  { municipality: 'Daet', barangayPopulation: 'Beta', barangayCaseRecord: 'Beta (Pob.)', matchType: 'manual' },
]

const row = (barangay: string, year: number, epiWeek: number | null, cases: number, municipality = 'Daet'): CaseRow => ({
  municipality, barangay, epiWeek, year, cases, deaths: 0,
})

const idx = (year: number, week: number) => (year - 2019) * 52 + (week - 1)

describe('buildWeeklyCases (small examples)', () => {
  it('puts cases in the right slot: (year - 2019) x 52 + (week - 1)', () => {
    const r = buildWeeklyCases(nameMap, [row('Alpha', 2019, 1, 4), row('Alpha', 2020, 3, 7)])
    expect(r.weekly.length).toBe(7 * 52)
    expect(r.weekly[idx(2019, 1)]).toBe(4)
    expect(r.weekly[idx(2020, 3)]).toBe(7)
  })

  it('adds up two barangays in the same week, and uses the case-record name', () => {
    const r = buildWeeklyCases(nameMap, [row('Alpha', 2019, 5, 2), row('Beta (Pob.)', 2019, 5, 3)])
    expect(r.weekly[idx(2019, 5)]).toBe(5)
  })

  it('a week with no record is 0 in a year that has records', () => {
    const r = buildWeeklyCases(nameMap, [row('Alpha', 2019, 10, 1)])
    expect(r.weekly[idx(2019, 11)]).toBe(0)
  })

  it('a year with no records at all is null in every week (a gap)', () => {
    const r = buildWeeklyCases(nameMap, [row('Alpha', 2019, 10, 1)])
    expect(r.yearsWithData).toEqual([2019])
    for (let w = 1; w <= 52; w++) expect(r.weekly[idx(2022, w)]).toBeNull()
  })

  it('ignores barangays that are not in the name map', () => {
    const r = buildWeeklyCases(nameMap, [row('Gamma', 2019, 5, 9), row('Alpha', 2019, 5, 1, 'Basud')])
    expect(r.weekly[idx(2019, 5)]).toBe(0)
  })

  it('skips "Not Encoded" rows and weeks outside 1 to 52', () => {
    const r = buildWeeklyCases(nameMap, [row('Alpha', 2019, null, 8), row('Alpha', 2019, 53, 8), row('Alpha', 2019, 0, 8)])
    expect(r.weekly.reduce<number>((s, v) => s + (v ?? 0), 0)).toBe(0)
  })
})

describe('buildWeeklyCases (real files)', () => {
  const nm = loadNameMap()
  const cases = loadBarangayCases()
  const r = buildWeeklyCases(nm, cases)

  const yearTotal = (year: number) => {
    const part = r.weekly.slice(idx(year, 1), idx(year, 52) + 1)
    return part.every((v) => v === null) ? null : part.reduce<number>((s, v) => s + (v ?? 0), 0)
  }

  it('has 7 years x 52 weeks', () => {
    expect(r.weekly.length).toBe(364)
  })

  it('has barangay-level records for 2019, 2020, 2021 and 2023 only', () => {
    expect(r.yearsWithData).toEqual([2019, 2020, 2021, 2023])
    for (const y of [2022, 2024, 2025]) expect(yearTotal(y)).toBeNull()
  })

  it('the weekly total equals the recorded cases of the modelled barangays, counted separately', () => {
    const keys = new Set(nm.map((n) => `${n.municipality}|${n.barangayCaseRecord}`))
    const expected = cases
      .filter((c) => c.epiWeek !== null && c.epiWeek >= 1 && c.epiWeek <= 52 && keys.has(`${c.municipality}|${c.barangay}`))
      .reduce((s, c) => s + c.cases, 0)
    const got = r.weekly.reduce<number>((s, v) => s + (v ?? 0), 0)
    expect(got).toBe(expected)
  })

  it('is smaller than the all-barangay total (the model covers part of the province)', () => {
    const all = cases.filter((c) => c.epiWeek !== null).reduce((s, c) => s + c.cases, 0)
    const got = r.weekly.reduce<number>((s, v) => s + (v ?? 0), 0)
    expect(got).toBeGreaterThan(0)
    expect(got).toBeLessThan(all)
  })

  it('prints the yearly totals', () => {
    const t = Object.fromEntries([2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y) => [y, yearTotal(y)]))
    console.log('Real cases in the 39 modelled barangays, per year:', t)
  })
})