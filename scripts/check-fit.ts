// Re-runs the best trials of a fit results file with several engine seeds, to see whether a good score holds up.
// Prints total cases, correlation, scoreV2 and fogging rounds for every run. Each run takes about 15 to 40 s.
// Usage: npx tsx scripts/check-fit.ts [--file path] [--top N] [--seeds N] [--out path]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FIT_KEYS, scoreV2 } from './fit-lib'
import { runTrial } from './fit-settings'
import { rescore } from './rescore-fit'
import type { SavedTrial } from './rescore-fit'
import type { WeeklyCases } from './prepare-lib'

export interface CheckArgs {
  file: string
  top: number
  seeds: number // engine seeds 1 to this number
  out: string
}

export interface CheckRun {
  seed: number
  totalSim: number
  correlation: number
  scoreV2: number
  foggingRounds: number
}

export interface CheckSummary {
  meanSim: number
  minSim: number
  maxSim: number
  meanScoreV2: number
  meanFogging: number
}

/** Reads `--file path`, `--top N`, `--seeds N` and `--out path`. Anything missing gets a default. */
export function parseCheckArgs(argv: string[]): CheckArgs {
  const args: CheckArgs = {
    file: 'data-private/fit-round2.json',
    top: 3,
    seeds: 3,
    out: 'data-private/fit-check.json',
  }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (flag === '--top' || flag === '--seeds') {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 1) throw new Error(`${flag} needs a whole number of 1 or more`)
      if (flag === '--top') args.top = n
      else args.seeds = n
      i++
    } else if (flag === '--file' || flag === '--out') {
      if (!value) throw new Error(`${flag} needs a file path`)
      if (flag === '--file') args.file = value
      else args.out = value
      i++
    } else {
      throw new Error(`Unknown option: ${flag}`)
    }
  }
  return args
}

/** Mean, lowest and highest simulated total, plus mean scoreV2 and mean fogging rounds, over the runs of one trial. */
export function summarize(runs: Pick<CheckRun, 'totalSim' | 'scoreV2' | 'foggingRounds'>[]): CheckSummary {
  if (runs.length === 0) throw new Error('summarize: no runs')
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
  const sims = runs.map((r) => r.totalSim)
  return {
    meanSim: mean(sims),
    minSim: Math.min(...sims),
    maxSim: Math.max(...sims),
    meanScoreV2: mean(runs.map((r) => r.scoreV2)),
    meanFogging: mean(runs.map((r) => r.foggingRounds)),
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf-8')) as T
}

function fmt(n: number, digits = 3): string {
  return Number.isNaN(n) ? 'n/a' : n.toFixed(digits)
}

function main(): void {
  const args = parseCheckArgs(process.argv.slice(2))
  const file = readJson<{ results: SavedTrial[] }>(args.file)
  const cases = readJson<WeeklyCases>('data-private/cases-weekly.json')
  const chosen = rescore(file.results).slice(0, args.top)
  const total = chosen.length * args.seeds
  const started = performance.now()
  let done = 0

  console.log(`Check: top ${chosen.length} trials of ${args.file} (ranked by scoreV2), engine seeds 1 to ${args.seeds}`)
  console.log(`${total} runs, each about 15 to 40 s\n`)

  const output: { trial: number; settings: SavedTrial['settings']; roundScoreV2: number; runs: CheckRun[]; summary: CheckSummary }[] = []

  for (const t of chosen) {
    const settingsText = FIT_KEYS.map((k) => `${k} ${t.settings[k].toFixed(4)}`).join(', ')
    console.log(`Trial ${t.trial} (round score ${fmt(t.scoreV2)}, sim ${Math.round(t.fit.totalSim)}): ${settingsText}`)
    const runs: CheckRun[] = []
    for (let seed = 1; seed <= args.seeds; seed++) {
      const { fit, foggingRounds } = runTrial(t.settings, cases.weekly, seed)
      const run: CheckRun = {
        seed,
        totalSim: fit.totalSim,
        correlation: fit.correlation,
        scoreV2: scoreV2(fit),
        foggingRounds,
      }
      runs.push(run)
      done++
      const elapsed = (performance.now() - started) / 1000
      const eta = (elapsed / done) * (total - done)
      console.log(
        `  seed ${seed}: sim ${Math.round(run.totalSim)}, corr ${fmt(run.correlation)}, scoreV2 ${fmt(run.scoreV2)}, ` +
          `fogging rounds ${run.foggingRounds} | about ${Math.ceil(eta / 60)} min left`,
      )
    }
    const summary = summarize(runs)
    console.log(
      `  summary: sim mean ${Math.round(summary.meanSim)} (${Math.round(summary.minSim)} to ${Math.round(summary.maxSim)}), ` +
        `mean scoreV2 ${fmt(summary.meanScoreV2)}, mean fogging rounds ${Math.round(summary.meanFogging)}\n`,
    )
    output.push({ trial: t.trial, settings: t.settings, roundScoreV2: t.scoreV2, runs, summary })
  }

  mkdirSync(resolve(process.cwd(), 'data-private'), { recursive: true })
  writeFileSync(resolve(process.cwd(), args.out), JSON.stringify({ file: args.file, seeds: args.seeds, trials: output }, null, 2))
  console.log(`Saved to ${args.out}`)
}

// Only runs when started from the command line, so tests can import parseCheckArgs and summarize.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()