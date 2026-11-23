// Turns two finished runs (the policy and the "do nothing" baseline) into what the page shows:
// weekly infection curves, totals, the percentage reduction, and weekly mosquitoes per person.
// Only infections from mosquito bites are counted: imports come from outside the study area,
// so the policy cannot reach them.

import type { RunResult } from '../engine/run'

export interface Comparison {
  baselineWeekly: number[] // infections per week, "do nothing"
  policyWeekly: number[] // infections per week, chosen policy
  baselineTotal: number
  policyTotal: number
  percentReduction: number | null // null when the baseline has no infections; negative if the policy is worse
  // Mosquitoes per person, the average over each week (not a sum), "do nothing" and chosen policy.
  baselineAdultsPerPerson: number[]
  policyAdultsPerPerson: number[]
  baselineImmaturesPerPerson: number[]
  policyImmaturesPerPerson: number[]
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

// The average of each block of 7 days; a last block with fewer days is averaged over the days it has.
export function weeklyAverages(daily: ArrayLike<number>): number[] {
  const totals = weeklyTotals(daily)
  return totals.map((total, week) => total / Math.min(7, daily.length - week * 7))
}

// The simulated people in the run. It never changes, so any day gives it; day 0 is used.
export function peopleIn(result: RunResult): number {
  if (result.days === 0) return 0
  return result.susceptible[0] + result.exposed[0] + result.infectious[0] + result.recovered[0]
}

// Weekly average of a daily mosquito count, divided by the number of people.
// With no people the numbers cannot be worked out, so every week is 0.
export function perPersonWeekly(daily: ArrayLike<number>, people: number): number[] {
  const averages = weeklyAverages(daily)
  return averages.map((a) => (people > 0 ? a / people : 0))
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
  const baselinePeople = peopleIn(baseline)
  const policyPeople = peopleIn(policy)
  return {
    baselineWeekly: weeklyTotals(baselineDaily),
    policyWeekly: weeklyTotals(policyDaily),
    baselineTotal,
    policyTotal,
    percentReduction: percentReduction(baselineTotal, policyTotal),
    baselineAdultsPerPerson: perPersonWeekly(baseline.adults, baselinePeople),
    policyAdultsPerPerson: perPersonWeekly(policy.adults, policyPeople),
    baselineImmaturesPerPerson: perPersonWeekly(baseline.immatures, baselinePeople),
    policyImmaturesPerPerson: perPersonWeekly(policy.immatures, policyPeople),
  }
}