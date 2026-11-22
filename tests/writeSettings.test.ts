import { describe, it, expect } from 'vitest'
import { settingsFromTrial } from '../scripts/settings-lib'
import type { FitResultsFile } from '../scripts/settings-lib'

const file: FitResultsFile = {
  results: [
    {
      trial: 60,
      settings: { biteRate: 0.24837017226110522, kPerPerson: 0.703366139884262, reportFrac: 0.0256728636729725, importedSurgeSize: 2.009052569512278 },
    },
    {
      trial: 52,
      settings: { biteRate: 0.2353, kPerPerson: 1.1488, reportFrac: 0.0076, importedSurgeSize: 23.1133 },
    },
  ],
}

describe('settingsFromTrial', () => {
  it('copies the four values of the chosen trial into the settings file names', () => {
    const s = settingsFromTrial(file, 52, 'test note')
    expect(s.bitingRate).toBe(0.2353)
    expect(s.carryingCapacityPerPerson).toBe(1.1488)
    expect(s.reportingFraction).toBe(0.0076)
    expect(s.importedSurgeSize).toBe(23.1133)
  })

  it('marks the settings as fitted and keeps the note', () => {
    const s = settingsFromTrial(file, 52, 'test note')
    expect(s.fitted).toBe(true)
    expect(s.note).toBe('test note')
  })

  it('keeps full precision', () => {
    const s = settingsFromTrial(file, 60, 'x')
    expect(s.bitingRate).toBe(0.24837017226110522)
    expect(s.carryingCapacityPerPerson).toBe(0.703366139884262)
  })

  it('picks the trial by its number, not by its position in the list', () => {
    expect(settingsFromTrial(file, 60, 'x').importedSurgeSize).toBe(2.009052569512278)
  })

  it('throws when the trial is not in the file', () => {
    expect(() => settingsFromTrial(file, 99, 'x')).toThrow('Trial 99 not found')
  })

  it('throws when a value is missing', () => {
    const bad: FitResultsFile = { results: [{ trial: 1, settings: { biteRate: 0.2, kPerPerson: 1, reportFrac: 0.01 } }] }
    expect(() => settingsFromTrial(bad, 1, 'x')).toThrow('importedSurgeSize')
  })
})