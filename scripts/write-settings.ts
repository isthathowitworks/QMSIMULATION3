// Copies one fitted trial into public/data/settings.json at full precision.
// Usage: npx tsx scripts/write-settings.ts <results file> <trial number>
// Example: npx tsx scripts/write-settings.ts data-private/fit-round2.json 52
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { settingsFromTrial } from './settings-lib'
import type { FitResultsFile } from './settings-lib'

const [fromPath, trialText] = process.argv.slice(2)
const trial = Number(trialText)
if (!fromPath || !Number.isInteger(trial)) {
  console.error('Usage: npx tsx scripts/write-settings.ts <results file> <trial number>')
  process.exit(1)
}

const file = JSON.parse(readFileSync(join(process.cwd(), fromPath), 'utf8')) as FitResultsFile
const note =
  `Fitted to real weekly cases in the 39 modelled barangays (trial ${trial} of ${fromPath}). ` +
  'Compliance is not fitted.'
const settings = settingsFromTrial(file, trial, note)

writeFileSync(join(process.cwd(), 'public', 'data', 'settings.json'), JSON.stringify(settings))
console.log('Wrote public/data/settings.json:')
console.log(settings)