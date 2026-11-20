// Data preparation logic. Pure functions, no file writing, so tests and the CLI share it.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const ROOT = process.cwd()
export const DATASETS = join(ROOT, 'Datasets')
export const CASES_DIR = join(DATASETS, 'Dengue Cases csv')
export const PEOPLE_PER_SIM_PERSON = 10
export const PEOPLE_PER_HOUSEHOLD = 5

/** Quote-aware CSV parser. Strips BOM, handles CRLF. Returns objects keyed by header. */
export function parseCsv(text: string): Record<string, string>[] {
  text = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

const read = (...p: string[]) => readFileSync(join(DATASETS, ...p), 'utf8')

export interface Weather { start: string; days: number; t2m: number[]; rain: number[]; rh: number[]; missing: number }

export function loadWeather(): Weather {
  const lines = read('weather.csv').split(/\r?\n/)
  const headerIdx = lines.findIndex((l) => l.startsWith('YEAR,'))
  if (headerIdx < 0) throw new Error('weather.csv: column header row not found')
  const rows = parseCsv(lines.slice(headerIdx).join('\n'))
  let missing = 0
  const num = (v: string) => { const n = Number(v); if (n === -999 || Number.isNaN(n)) missing++; return n }
  const t2m = rows.map((r) => num(r.T2M)), rain = rows.map((r) => num(r.PRECTOTCORR)), rh = rows.map((r) => num(r.RH2M))
  const f = rows[0]
  const start = `${f.YEAR}-${f.MO.padStart(2, '0')}-${f.DY.padStart(2, '0')}`
  return { start, days: rows.length, t2m, rain, rh, missing }
}

export interface Barangay { municipality: string; barangay: string; population: number; simPeople: number; households: number }

export function loadPopulation(): Barangay[] {
  return parseCsv(read('population.csv')).map((r) => {
    const population = Number(r.Population_2024)
    const simPeople = Math.round(population / PEOPLE_PER_SIM_PERSON)
    return { municipality: r.Municipality, barangay: r.Barangay, population, simPeople, households: Math.max(1, Math.round(simPeople / PEOPLE_PER_HOUSEHOLD)) }
  })
}

export interface PolicyRow { municipality: string; wasteCollectionIntervalDays: number; foggingTriggerCases: number }
export function loadPolicy(): PolicyRow[] {
  return parseCsv(read('policy_data.csv')).map((r) => ({
    municipality: r.Municipality,
    wasteCollectionIntervalDays: Number(r.Waste_Collection_Interval_Days),
    foggingTriggerCases: Number(r.Fogging_Trigger_Cases),
  }))
}

type Ring = number[][]
export interface MapData { type: string; features: { type: string; properties: Record<string, unknown>; geometry: { type: string; coordinates: any } }[] }
export const loadMap = (): MapData => JSON.parse(read('camarines_norte_map.json'))

function ringCentroid(ring: Ring): { x: number; y: number; area: number } {
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1]
    const k = x0 * y1 - x1 * y0
    a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k
  }
  a /= 2
  return a === 0 ? { x: ring[0][0], y: ring[0][1], area: 0 } : { x: cx / (6 * a), y: cy / (6 * a), area: Math.abs(a) }
}

/** Centroid (lon, lat) of the largest outer ring. Good enough for travel distances at provincial scale. */
export function municipalityCentroids(map: MapData): Record<string, { lon: number; lat: number }> {
  const out: Record<string, { lon: number; lat: number }> = {}
  for (const f of map.features) {
    const g = f.geometry
    const polys: Ring[][] = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
    const best = polys.map((p) => ringCentroid(p[0])).sort((a, b) => b.area - a.area)[0]
    out[String(f.properties.adm3_en)] = { lon: best.x, lat: best.y }
  }
  return out
}

export interface NameMapRow { municipality: string; barangayPopulation: string; barangayCaseRecord: string; matchType: string }
export const loadNameMap = (): NameMapRow[] =>
  parseCsv(readFileSync(join(ROOT, 'data-raw', 'barangay-name-map.csv'), 'utf8')).map((r) => ({
    municipality: r.municipality, barangayPopulation: r.barangay_population, barangayCaseRecord: r.barangay_case_record, matchType: r.match_type,
  }))

export interface CaseRow { municipality: string; barangay: string; epiWeek: number | null; year: number; cases: number; deaths: number }
/** The barangay-level case file. Found by name pattern so small spelling differences in the file name do not matter. */
function barangayCaseFile(): string {
  const f = readdirSync(CASES_DIR).find((n) => /FOIBy.?Municipality.*\.csv$/i.test(n))
  if (!f) throw new Error('Barangay-level case file (…FOIBy_Municipality.csv) not found in Datasets/Dengue Cases csv')
  return join(CASES_DIR, f)
}
export const loadBarangayCases = (): CaseRow[] =>
  parseCsv(readFileSync(barangayCaseFile(), 'utf8')).map((r) => ({
    municipality: r.Municipality, barangay: r.Barangay, epiWeek: /^\d+$/.test(r.Epi_Week) ? Number(r.Epi_Week) : null,
    year: Number(r.Year), cases: Number(r.Cases), deaths: Number(r.Deaths),
  }))

export interface Check { name: string; ok: boolean; detail: string }

/** The section 7 data checks. Returns every result; callers decide how to fail. */
export function runDataChecks(): Check[] {
  const w = loadWeather(), pop = loadPopulation(), pol = loadPolicy(), map = loadMap(), nm = loadNameMap(), cases = loadBarangayCases()
  const checks: Check[] = []
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail })

  add('weather: 2,557 daily rows', w.days === 2557, `${w.days} rows, starts ${w.start}`)
  add('weather: no -999 or unreadable values', w.missing === 0, `${w.missing} missing`)
  add('weather: temperature in plausible range', Math.min(...w.t2m) > 15 && Math.max(...w.t2m) < 40, `${Math.min(...w.t2m)}..${Math.max(...w.t2m)} C`)

  const total = pop.reduce((s, b) => s + b.population, 0)
  const muns = new Set(pop.map((b) => b.municipality))
  add('population: totals 189,837', total === 189837, `${total}`)
  add('population: 39 barangays', pop.length === 39, `${pop.length}`)
  add('population: 12 municipalities', muns.size === 12, `${muns.size}`)

  const mapNames = new Set(map.features.map((f) => String(f.properties.adm3_en)))
  const polNames = new Set(pol.map((p) => p.municipality))
  const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))
  add('municipality names match across population, policy and map', same(muns, mapNames) && same(muns, polNames),
    `pop ${muns.size}, policy ${polNames.size}, map ${mapNames.size}`)

  const pairs = new Set(cases.map((c) => `${c.municipality}|${c.barangay}`))
  const popKeys = new Set(pop.map((b) => `${b.municipality}|${b.barangay}`))
  const mapped = nm.filter((r) => r.matchType !== 'UNMATCHED')
  add('name map: covers every modelled barangay exactly once',
    nm.length === pop.length && nm.every((r) => popKeys.has(`${r.municipality}|${r.barangayPopulation}`)), `${nm.length} rows`)
  add('name map: every mapped name exists in the case records',
    mapped.every((r) => pairs.has(`${r.municipality}|${r.barangayCaseRecord}`)), `${mapped.length} mapped, ${nm.length - mapped.length} unmatched`)

  const notEncoded = cases.filter((c) => c.epiWeek === null)
  add('cases: "Not Encoded" weeks found and flagged', notEncoded.length === 1, `${notEncoded.length} row(s)`)
  add('cases: 242 municipality+barangay pairs', pairs.size === 242, `${pairs.size}`)
  return checks
}