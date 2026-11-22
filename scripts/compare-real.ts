// Runs the simulation once from public/data/settings.json (engine seed 1) and prints real against
// simulated weekly cases (plan step 4.4).
// Usage: npx tsx scripts/compare-real.ts
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
import { weeklyReported } from './fit-lib'
import { compareYears } from './compare-lib'
import type { WeeklyCases } from './prepare-lib'

const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(process.cwd(), path), 'utf8')) as T

const settings = readJson<SettingsFile>('public/data/settings.json')
const real = readJson<WeeklyCases>('data-private/cases-weekly.json')
const params = paramsFromSettings(settings)

const world = buildWorld(readJson<PopulationFile>('public/data/population.json'))
const weather = buildWeather(readJson<WeatherFile>('public/data/weather.json'))
const policyFile = readJson<PolicyFile>('public/data/policy.json')
const policy = buildPolicyArrays(world, policyFile)
const compliance = new Float64Array(policy.intervals.length).fill(params.compliance)

const t0 = performance.now()
const result = runSimulation(world, weather, policy, policyFile.centroids, compliance, params, 1)
const seconds = (performance.now() - t0) / 1000
const sim = weeklyReported(result.onsets, result.municipalityCount, params.scale, params.reportFrac)

const f = (v: number | null, digits = 1) => (v === null ? '-' : v.toFixed(digits))
const rows = compareYears(real.weekly, sim, real.firstYear, real.weeksPerYear)

console.log(`Run took ${seconds.toFixed(1)} s (settings fitted: ${settings.fitted}, engine seed 1)\n`)
console.log('Year   real total   sim total   real peak (week)    sim peak (week)')
for (const r of rows) {
  const realPeak = r.realPeakCases === null ? '-' : `${f(r.realPeakCases)} (wk ${r.realPeakWeek ?? '-'})`
  const simPeak = `${f(r.simPeakCases)} (wk ${r.simPeakWeek ?? '-'})`
  console.log(
    `${r.year}  ${f(r.realTotal, 0).padStart(10)}  ${f(r.simTotal, 0).padStart(10)}   ` +
      `${realPeak.padEnd(18)}  ${simPeak}`,
  )
}
const withReal = rows.filter((r) => r.realTotal !== null)
const realSum = withReal.reduce((a, r) => a + (r.realTotal ?? 0), 0)
const simSum = withReal.reduce((a, r) => a + r.simTotal, 0)
console.log(`\nYears with real data: real ${f(realSum, 0)}, simulated ${f(simSum, 0)}`)

console.log(`\n${real.firstYear} by week (* = surge weeks 30 to 44)`)
console.log('Week     real      sim')
for (let w = 1; w <= real.weeksPerYear; w++) {
  const mark = w >= 30 && w <= 44 ? '*' : ' '
  console.log(`${String(w).padStart(4)}${mark} ${f(real.weekly[w - 1], 0).padStart(7)}  ${f(sim[w - 1]).padStart(7)}`)
}