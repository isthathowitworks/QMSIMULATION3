// Runs trial 52 (from settings.json, engine seed 1) once per background import rate and prints one row each.
// Question: does a higher background import rate lift the quiet years towards the real cases?
// Usage: npx tsx scripts/compare-imports.ts [rate rate ...]   (default rates 0.05 0.2 0.5 1 2)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runSimulation } from '../src/engine/run'
import { buildWeather } from '../src/engine/weather'
import type { WeatherFile } from '../src/engine/weather'
import { buildWorld } from '../src/engine/population'
import type { PopulationFile } from '../src/engine/population'
import { buildPolicyArrays } from '../src/engine/policyData'
import type { PolicyFile } from '../src/engine/policyData'
import { paramsFromSettings } from '../src/engine/params'
import type { SettingsFile } from '../src/engine/params'
import { scoreFit, scoreV2, weeklyReported } from './fit-lib'
import { sumRange } from './compare-lib'
import type { WeeklyCases } from './prepare-lib'

const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(process.cwd(), path), 'utf8')) as T

const rates = process.argv.length > 2 ? process.argv.slice(2).map(Number) : [0.05, 0.2, 0.5, 1, 2]
if (rates.some((r) => !Number.isFinite(r) || r < 0)) {
  console.error('Usage: npx tsx scripts/compare-imports.ts [rate rate ...] (numbers of 0 or more)')
  process.exit(1)
}

const settings = readJson<SettingsFile>('public/data/settings.json')
const real = readJson<WeeklyCases>('data-private/cases-weekly.json')
const base = paramsFromSettings(settings)

const world = buildWorld(readJson<PopulationFile>('public/data/population.json'))
const weather = buildWeather(readJson<WeatherFile>('public/data/weather.json'))
const policyFile = readJson<PolicyFile>('public/data/policy.json')
const policy = buildPolicyArrays(world, policyFile)
const compliance = new Float64Array(policy.intervals.length).fill(base.compliance)

// Week blocks as index ranges (52 weeks per year, 2019 first): 2019 weeks 1-29, surge 30-44, weeks 45-52, then whole years.
const BLOCKS: [string, number, number][] = [
  ['19 wk1-29', 0, 29],
  ['19 surge', 29, 44],
  ['19 wk45-52', 44, 52],
  ['2020', 52, 104],
  ['2021', 104, 156],
  ['2023', 208, 260],
]

const cell = (v: string, width = 11) => v.padStart(width)
const header = ['import/day/100k', ...BLOCKS.map((b) => b[0]), 'total', 'corr', 'scoreV2']
console.log(header.map((h, i) => (i === 0 ? h.padEnd(16) : cell(h))).join(''))
console.log(
  'real'.padEnd(16) +
    BLOCKS.map(([, s, e]) => cell(sumRange(real.weekly, s, e).toFixed(0))).join('') +
    cell(sumRange(real.weekly, 0, real.weekly.length).toFixed(0)),
)

for (const rate of rates) {
  const params = { ...base, importPerDayPer100k: rate }
  const t0 = performance.now()
  const result = runSimulation(world, weather, policy, policyFile.centroids, compliance, params, 1)
  const seconds = (performance.now() - t0) / 1000
  const sim = weeklyReported(result.onsets, result.municipalityCount, params.scale, params.reportFrac)
  const fit = scoreFit(real.weekly, sim)
  console.log(
    String(rate).padEnd(16) +
      BLOCKS.map(([, s, e]) => cell(sumRange(sim, s, e).toFixed(0))).join('') +
      cell(fit.totalSim.toFixed(0)) +
      cell(fit.correlation.toFixed(3)) +
      cell(scoreV2(fit).toFixed(3)) +
      `   (${seconds.toFixed(0)} s)`,
  )
}
console.log('\n"total" is simulated cases over the weeks that have real data (2019, 2020, 2021, 2023).')