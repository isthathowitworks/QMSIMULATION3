// Turns two finished runs (the policy and the "do nothing" baseline) into what the page shows:
// weekly infection curves, totals and the percentage reduction.
// Only infections from mosquito bites are counted: imports come from outside the study area,
// so the policy cannot reach them.

import type { RunResult } from '../engine/run'

export interface Comparison {
  baselineWeekly: number[] // infections per week, "do nothing"
  policyWeekly: number[] // infections per week, chosen policy
  baselineTotal: number
  policyTotal: number
  percentReduction: number | null // null when the baseline has no infections; negative if the policy is worse
}

// People infected by mosquito bites each day.
export function mosquitoInfections(result: RunResult): Int32Array {
  const out = new Int32Array(result.days)
  for (let d = 0; d < result.days; d++) out[d] = result.newInfections[d] - result.imported[d]
  return out
}

export function totalOf(values: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < values.length; i++) sum += values[i]
  return sum
}

// Adds up each block of 7 days; a last block with fewer days is kept.
export function weeklyTotals(daily: ArrayLike<number>): number[] {
  const weeks: number[] = []
  for (let i = 0; i < daily.length; i++) {
    const week = Math.floor(i / 7)
    weeks[week] = (weeks[week] ?? 0) + daily[i]
  }
  return weeks
}

// (baseline - policy) / baseline, in percent.
export function percentReduction(baselineTotal: number, policyTotal: number): number | null {
  if (!(baselineTotal > 0)) return null
  return ((baselineTotal - policyTotal) / baselineTotal) * 100
}

export function compareRuns(baseline: RunResult, policy: RunResult): Comparison {
  if (baseline.days !== policy.days) {
    throw new Error(`the two runs have a different number of days (${baseline.days} and ${policy.days})`)
  }
  const baselineDaily = mosquitoInfections(baseline)
  const policyDaily = mosquitoInfections(policy)
  const baselineTotal = totalOf(baselineDaily)
  const policyTotal = totalOf(policyDaily)
  return {
    baselineWeekly: weeklyTotals(baselineDaily),
    policyWeekly: weeklyTotals(policyDaily),
    baselineTotal,
    policyTotal,
    percentReduction: percentReduction(baselineTotal, policyTotal),
  }
}