// Re-scores the saved trials in a fit results file with scoreV2 and prints the best ones.
// No engine run, so it takes a second. Usage: npx tsx scripts/rescore-fit.ts [path] [--top N]
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FIT_KEYS, scoreV2 } from './fit-lib'
import type { FitSettings } from './fit-lib'

/** A trial as saved by fit-settings.ts. A correlation that was NaN is saved as null. */
export interface SavedTrial {
  trial: number
  settings: FitSettings
  fit: { correlation: number | null; totalReal: number; totalSim: number; rmse: number }
}

export interface RescoredTrial extends SavedTrial {
  scoreV2: number
}

/** Adds scoreV2 to every trial and sorts best (lowest) first. */
export function rescore(trials: SavedTrial[]): RescoredTrial[] {
  return trials
    .map((t) => ({
      ...t,
      scoreV2: scoreV2({
        correlation: t.fit.correlation ?? NaN,
        totalReal: t.fit.totalReal,
        totalSim: t.fit.totalSim,
      }),
    }))
    .sort((a, b) => a.scoreV2 - b.scoreV2)
}

function main(): void {
  const argv = process.argv.slice(2)
  let path = 'data-private/fit-results.json'
  let top = 10
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--top') {
      top = Number(argv[++i])
      if (!Number.isInteger(top) || top < 1) throw new Error('--top needs a whole number of 1 or more')
    } else {
      path = argv[i]
    }
  }

  const file = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf-8')) as { results: SavedTrial[] }
  const ranked = rescore(file.results)
  console.log(`Re-scored ${ranked.length} trials from ${path} (lower scoreV2 is better)\n`)

  for (const t of ranked.slice(0, top)) {
    const s = FIT_KEYS.map((k) => `${k} ${t.settings[k].toFixed(3)}`).join(', ')
    console.log(
      `Trial ${t.trial}: scoreV2 ${t.scoreV2.toFixed(3)}, corr ${t.fit.correlation === null ? 'n/a' : t.fit.correlation.toFixed(3)}, ` +
        `cases real ${Math.round(t.fit.totalReal)} sim ${Math.round(t.fit.totalSim)}\n    ${s}`,
    )
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()