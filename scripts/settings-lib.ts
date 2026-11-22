// Turns one trial from a fit results file into the contents of settings.json.
import type { SettingsFile } from '../src/engine/params'
import type { FitSettings } from './fit-lib'

export interface FitTrialEntry {
  trial: number
  settings: Record<string, number>
}

export interface FitResultsFile {
  results: FitTrialEntry[]
}

export function settingsFromTrial(file: FitResultsFile, trialNumber: number, note: string): SettingsFile {
  const entry = file.results.find((r) => r.trial === trialNumber)
  if (!entry) throw new Error(`Trial ${trialNumber} not found in the fit results`)
  const s = entry.settings
  for (const k of ['biteRate', 'kPerPerson', 'reportFrac', 'importedSurgeSize']) {
    if (typeof s[k] !== 'number' || !Number.isFinite(s[k])) {
      throw new Error(`Trial ${trialNumber} has no usable value for ${k}`)
    }
  }
  return {
    fitted: true,
    note,
    bitingRate: s.biteRate,
    carryingCapacityPerPerson: s.kPerPerson,
    reportingFraction: s.reportFrac,
    importedSurgeSize: s.importedSurgeSize,
  }
}


/** The four settings.json values under the names the fit uses (the reverse of what write-settings does). */
export function fitSettingsFromFile(file: SettingsFile): FitSettings {
  return {
    biteRate: file.bitingRate,
    kPerPerson: file.carryingCapacityPerPerson,
    reportFrac: file.reportingFraction,
    importedSurgeSize: file.importedSurgeSize,
  }
}