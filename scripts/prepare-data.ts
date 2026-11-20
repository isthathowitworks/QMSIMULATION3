// Cleans raw study files in data-raw/ into small JSON files in public/data/.
// Usage: npm run prepare-data
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadWeather, loadPopulation, loadPolicy, loadMap, municipalityCentroids, runDataChecks } from './prepare-lib'

const OUT = join(process.cwd(), 'public', 'data')
mkdirSync(OUT, { recursive: true })

const checks = runDataChecks()
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  (${c.detail})`)
if (checks.some((c) => !c.ok)) { console.error('\nData checks failed. Nothing written.'); process.exit(1) }

const w = loadWeather()
const round = (a: number[], d: number) => a.map((v) => Number(v.toFixed(d)))
const write = (name: string, data: unknown) => writeFileSync(join(OUT, name), JSON.stringify(data))

write('weather.json', { start: w.start, days: w.days, t2m: round(w.t2m, 2), rain: round(w.rain, 2), rh: round(w.rh, 1) })

const pop = loadPopulation()
write('population.json', { peoplePerSimPerson: 10, peoplePerHousehold: 5, barangays: pop })

const map = loadMap()
write('policy.json', { municipalities: loadPolicy(), centroids: municipalityCentroids(map) })
write('camarines_norte_map.json', map)

// settings.json is the single place for fitted values. Never overwrite it once it exists.
const settingsPath = join(OUT, 'settings.json')
if (!existsSync(settingsPath)) {
  write('settings.json', {
    fitted: false,
    note: 'PLACEHOLDER values. Replace by running fit-settings (milestone M4).',
    bitingRate: 0.3, carryingCapacityPerPerson: 3, reportingFraction: 0.1, importedSurgeSize: 20,
  })
}
const sim = pop.reduce((s, b) => s + b.simPeople, 0), hh = pop.reduce((s, b) => s + b.households, 0)
console.log(`\nWrote public/data. Simulated people: ${sim}, households: ${hh}`)