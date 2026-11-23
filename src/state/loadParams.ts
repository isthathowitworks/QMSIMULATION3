// Loads public/data/settings.json and lays it over the starting positions.
// The page needs this because the worker takes its settings from each run request.

import type { Params, SettingsFile } from '../engine/params'
import { DEFAULT_PARAMS, paramsFromSettings } from '../engine/params'

// `baseUrl` is import.meta.env.BASE_URL in the page. `fetchFn` is only given in tests.
export async function loadParams(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<Params> {
  const url = `${baseUrl}data/settings.json`
  const response = await fetchFn(url)
  if (!response.ok) throw new Error(`could not load ${url} (status ${response.status})`)
  const settings = (await response.json()) as SettingsFile
  const values = [
    settings.bitingRate,
    settings.carryingCapacityPerPerson,
    settings.reportingFraction,
    settings.importedSurgeSize,
  ]
  if (!values.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    throw new Error(`${url} is missing a setting or has a value that is not a number`)
  }
  return paramsFromSettings(settings, DEFAULT_PARAMS)
}