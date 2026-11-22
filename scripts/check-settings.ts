// Runs the simulation once from public/data/settings.json (engine seed 1) and compares with the real cases.
// Usage: npx tsx scripts/check-settings.ts
// Expected for trial 52: about 459 simulated cases against 470 real.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_PARAMS, paramsFromSettings } from '../src/engine/params'
import type { SettingsFile } from '../src/engine/params'
import { fitSettingsFromFile } from './settings-lib'
import { paramsForTrial, runTrial } from './fit-settings'
import type { WeeklyCases } from './prepare-lib'

const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(process.cwd(), path), 'utf8')) as T

const file = readJson<SettingsFile>('public/data/settings.json')
const real = readJson<WeeklyCases>('data-private/cases-weekly.json')
const fitSettings = fitSettingsFromFile(file)

const same = JSON.stringify(paramsFromSettings(file)) === JSON.stringify(paramsForTrial(fitSettings))
console.log(`App params equal the fit params: ${same}`)
console.log(`Fitted flag: ${file.fitted}, compliance ${DEFAULT_PARAMS.compliance}`)

const { fit, seconds, foggingRounds } = runTrial(fitSettings, real.weekly, 1)
console.log(`Run took ${seconds.toFixed(1)} s, fogging rounds ${foggingRounds}`)
console.log(`Cases: real ${Math.round(fit.totalReal)}, simulated ${Math.round(fit.totalSim)}`)
console.log(`Correlation ${fit.correlation.toFixed(3)}, scoreV2 not computed here (see check-fit.ts)`)