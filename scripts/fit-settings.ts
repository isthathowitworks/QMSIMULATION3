// Fits biteRate, kPerPerson, reportFrac and importedSurgeSize to the real weekly cases (plan step 4.2b).
// Runs under the real policy (policy.json) with compliance at its starting position. One run per trial.
// Usage: npm run fit -- --trials 30 --seed 1 --range reportFrac=0.005:0.15 --out data-private/fit-round2.json
// Results are saved after every trial, so Ctrl+C keeps what has finished.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runSimulation } from '../src/engine/run'
import { buildWeather } from '../src/engine/weather'
import type { WeatherFile } from '../src/engine/weather'
import { buildWorld } from '../src/engine/population'
import type { PopulationFile } from '../src/engine/population'
import { buildPolicyArrays } from '../src/engine/policyData'
import type { PolicyFile } from '../src/engine/policyData'
import { DEFAULT_PARAMS } from '../src/engine/params'
import type { Params } from '../src/engine/params'
import { FIT_KEYS, FIT_RANGES, latinHypercube, scoreFit, weeklyReported } from './fit-lib'
import type { FitRanges, FitScore, FitSettings } from './fit-lib'
import type { WeeklyCases } from './prepare-lib'

export interface FitArgs {
  trials: number
  seed: number
  out: string
  ranges: FitRanges
}

export interface TrialResult {
  trial: number
  settings: FitSettings
  fit: FitScore
  seconds: number
  foggingRounds: number
}

/** Reads one `--range` value like `reportFrac=0.005:0.15`. The low end must be below the high end. */
export function parseRange(text: string): { key: keyof FitSettings; range: [number, number] } {
  const bad = `--range needs key=low:high, for example reportFrac=0.005:0.15 (got "${text}")`
  const sides = text.split('=')
  if (sides.length !== 2 || sides[0] === '') throw new Error(bad)
  const name = sides[0]
  if (!(FIT_KEYS as string[]).includes(name)) {
    throw new Error(`Unknown setting in --range: ${name} (use ${FIT_KEYS.join(', ')})`)
  }
  const parts = sides[1].split(':')
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') throw new Error(bad)
  const lo = Number(parts[0])
  const hi = Number(parts[1])
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) throw new Error(bad)
  if (lo >= hi) throw new Error(`--range ${name}: the low end must be below the high end (got ${lo}:${hi})`)
  return { key: name as keyof FitSettings, range: [lo, hi] }
}

/** Reads `--trials N`, `--seed N`, `--out path` and `--range key=low:high` (can be repeated).
 *  Anything missing gets a default; ranges not named keep the ranges in FIT_RANGES. */
export function parseArgs(argv: string[]): FitArgs {
  const args: FitArgs = { trials: 30, seed: 1, out: 'data-private/fit-results.json', ranges: { ...FIT_RANGES } }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (flag === '--trials' || flag === '--seed') {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 1) throw new Error(`${flag} needs a whole number of 1 or more`)
      if (flag === '--trials') args.trials = n
      else args.seed = n
      i++
    } else if (flag === '--out') {
      if (!value) throw new Error('--out needs a file path')
      args.out = value
      i++
    } else if (flag === '--range') {
      if (!value) throw new Error('--range needs key=low:high, for example reportFrac=0.005:0.15')
      const { key, range } = parseRange(value)
      args.ranges[key] = range
      i++
    } else {
      throw new Error(`Unknown option: ${flag}`)
    }
  }
  return args
}

/** The starting positions with the four fitted settings laid over them. */
export function paramsForTrial(settings: FitSettings): Params {
  return { ...DEFAULT_PARAMS, ...settings }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf-8')) as T
}

function fmt(n: number, digits = 3): string {
  return Number.isNaN(n) ? 'n/a' : n.toFixed(digits)
}

/** One full run with the given settings, scored against the real weekly cases.
 *  `seed` is the engine's random seed (the fit always uses 1). Also returns the fogging rounds of the whole run. */
export function runTrial(
  settings: FitSettings,
  real: (number | null)[],
  seed = 1,
): { fit: FitScore; seconds: number; foggingRounds: number } {
  // The world and policy are built fresh for every trial, so one run can never affect the next.
  const world = buildWorld(readJson<PopulationFile>('public/data/population.json'))
  const weather = buildWeather(readJson<WeatherFile>('public/data/weather.json'))
  const policyFile = readJson<PolicyFile>('public/data/policy.json')
  const policy = buildPolicyArrays(world, policyFile)
  const params = paramsForTrial(settings)
  const compliance = new Float64Array(policy.intervals.length).fill(params.compliance)

  const t0 = performance.now()
  const r = runSimulation(world, weather, policy, policyFile.centroids, compliance, params, seed)
  const seconds = (performance.now() - t0) / 1000

  let foggingRounds = 0
  for (const v of r.foggingRounds) foggingRounds += v

  // Reported cases = infections x scale x reportFrac (made here, not inside the engine).
  const sim = weeklyReported(r.onsets, r.municipalityCount, params.scale, settings.reportFrac)
  return { fit: scoreFit(real, sim), seconds, foggingRounds }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const cases = readJson<WeeklyCases>('data-private/cases-weekly.json')
  const trials = latinHypercube(args.trials, args.seed, args.ranges)
  const results: TrialResult[] = []
  const started = performance.now()

  mkdirSync(resolve(process.cwd(), 'data-private'), { recursive: true })
  console.log(`Fit: ${args.trials} trials, seed ${args.seed}, real policy, compliance ${DEFAULT_PARAMS.compliance}`)
  console.log(`Ranges: ${FIT_KEYS.map((k) => `${k} ${args.ranges[k][0]} to ${args.ranges[k][1]}`).join(', ')}`)
  console.log(`Saving to ${args.out}`)

  for (let i = 0; i < trials.length; i++) {
    const settings = trials[i]
    const { fit, seconds, foggingRounds } = runTrial(settings, cases.weekly)
    results.push({ trial: i + 1, settings, fit, seconds, foggingRounds })

    const best = results.reduce((a, b) => (b.fit.score < a.fit.score ? b : a))
    const elapsed = (performance.now() - started) / 1000
    const eta = (elapsed / results.length) * (args.trials - results.length)
    console.log(
      `Trial ${i + 1}/${args.trials} (${seconds.toFixed(1)} s): score ${fmt(fit.score)}, ` +
        `rmse ${fmt(fit.rmse)}, corr ${fmt(fit.correlation)}, cases real ${Math.round(fit.totalReal)} sim ${Math.round(fit.totalSim)}, ` +
        `fogging rounds ${foggingRounds} | ` +
        `best so far: trial ${best.trial}, score ${fmt(best.fit.score)} | about ${Math.ceil(eta / 60)} min left`,
    )

    const sorted = [...results].sort((a, b) => a.fit.score - b.fit.score)
    writeFileSync(
      resolve(process.cwd(), args.out),
      JSON.stringify(
        { seed: args.seed, trialsPlanned: args.trials, keys: FIT_KEYS, ranges: args.ranges, results: sorted },
        null,
        2,
      ),
    )
  }

  const top = [...results].sort((a, b) => a.fit.score - b.fit.score)[0]
  console.log('\nBest settings found (old score; rank with scoreV2 using scripts/rescore-fit.ts):')
  for (const key of FIT_KEYS) console.log(`  ${key}: ${top.settings[key].toFixed(4)}`)
  console.log(`  score ${fmt(top.fit.score)} (trial ${top.trial})\nSaved to ${args.out}`)
}

// Only runs when started from the command line, so tests can import parseArgs and paramsForTrial.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()