import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildWeeklyCases, loadBarangayCases, loadNameMap, type WeeklyCases } from '../scripts/prepare-lib'

const FILE = join(process.cwd(), 'data-private', 'cases-weekly.json')

describe('data-private/cases-weekly.json', () => {
  it('exists (run npm run prepare-data if this fails)', () => {
    expect(existsSync(FILE)).toBe(true)
  })

  const saved: WeeklyCases = JSON.parse(readFileSync(FILE, 'utf8'))

  it('has the right shape: 2019 start, 52 weeks per year, 364 values', () => {
    expect(saved.firstYear).toBe(2019)
    expect(saved.weeksPerYear).toBe(52)
    expect(saved.weekly.length).toBe(364)
  })

  it('has data for 2019, 2020, 2021 and 2023 and gaps (null) for 2022, 2024, 2025', () => {
    expect(saved.yearsWithData).toEqual([2019, 2020, 2021, 2023])
    const yearSlice = (y: number) => saved.weekly.slice((y - 2019) * 52, (y - 2019) * 52 + 52)
    for (const y of [2022, 2024, 2025]) expect(yearSlice(y).every((v) => v === null)).toBe(true)
    for (const y of [2019, 2020, 2021, 2023]) expect(yearSlice(y).every((v) => typeof v === 'number')).toBe(true)
  })

  it('has no negative or fractional case counts', () => {
    for (const v of saved.weekly) if (v !== null) expect(Number.isInteger(v) && v >= 0).toBe(true)
  })

  it('is up to date with the case file and the name map', () => {
    expect(saved).toEqual(buildWeeklyCases(loadNameMap(), loadBarangayCases()))
  })
})