// Helpers for comparing simulated weekly cases with real ones (plan step 4.4). Pure functions.

export interface YearComparison {
  year: number
  realTotal: number | null // null: no real records that year (a gap)
  simTotal: number
  realPeakWeek: number | null // week 1 to 52 with the most cases; null for a gap or a year with no cases
  realPeakCases: number | null
  simPeakWeek: number | null // null when the year has no simulated cases
  simPeakCases: number
}

function peak(values: number[]): { week: number | null; cases: number } {
  let best = 0
  let week: number | null = null
  for (let i = 0; i < values.length; i++) {
    if (values[i] > best) {
      best = values[i]
      week = i + 1
    }
  }
  return { week, cases: best }
}

/** One row per year: totals and the peak week, real against simulated.
 *  A year where every real week is null has no real data, so its real values are null. */
export function compareYears(
  real: (number | null)[],
  sim: number[],
  firstYear: number,
  weeksPerYear: number,
): YearComparison[] {
  if (real.length !== sim.length) {
    throw new Error(`compareYears: real has ${real.length} weeks but sim has ${sim.length}`)
  }
  const rows: YearComparison[] = []
  const years = Math.floor(real.length / weeksPerYear)
  for (let y = 0; y < years; y++) {
    const realWeeks = real.slice(y * weeksPerYear, (y + 1) * weeksPerYear)
    const simWeeks = sim.slice(y * weeksPerYear, (y + 1) * weeksPerYear)
    const hasReal = realWeeks.some((v) => v !== null)
    const realPeak = peak(realWeeks.map((v) => v ?? 0))
    const simPeak = peak(simWeeks)
    rows.push({
      year: firstYear + y,
      realTotal: hasReal ? realWeeks.reduce<number>((a, v) => a + (v ?? 0), 0) : null,
      simTotal: simWeeks.reduce((a, v) => a + v, 0),
      realPeakWeek: hasReal ? realPeak.week : null,
      realPeakCases: hasReal ? realPeak.cases : null,
      simPeakWeek: simPeak.week,
      simPeakCases: simPeak.cases,
    })
  }
  return rows
}

/** Sum of values[start] up to (not including) values[end]. A null week counts as 0. */
export function sumRange(values: (number | null)[], start: number, end: number): number {
  return values.slice(start, end).reduce<number>((a, v) => a + (v ?? 0), 0)
}