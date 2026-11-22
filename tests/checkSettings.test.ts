import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { paramsFromSettings } from '../src/engine/params'
import type { SettingsFile } from '../src/engine/params'
import { fitSettingsFromFile } from '../scripts/settings-lib'
import { paramsForTrial } from '../scripts/fit-settings'

const sample: SettingsFile = {
  fitted: true,
  bitingRate: 0.23526104073893897,
  carryingCapacityPerPerson: 1.1487920513609424,
  reportingFraction: 0.007563264196913224,
  importedSurgeSize: 23.113258935511112,
}

describe('fitSettingsFromFile', () => {
  it('renames the four values to the names the fit uses', () => {
    const f = fitSettingsFromFile(sample)
    expect(f.biteRate).toBe(sample.bitingRate)
    expect(f.kPerPerson).toBe(sample.carryingCapacityPerPerson)
    expect(f.reportFrac).toBe(sample.reportingFraction)
    expect(f.importedSurgeSize).toBe(sample.importedSurgeSize)
  })

  it('gives the app the same params as the fit used', () => {
    expect(paramsFromSettings(sample)).toEqual(paramsForTrial(fitSettingsFromFile(sample)))
  })

  it('does so for the real public/data/settings.json too', () => {
    const real = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'settings.json'), 'utf8')) as SettingsFile
    expect(paramsFromSettings(real)).toEqual(paramsForTrial(fitSettingsFromFile(real)))
  })
})