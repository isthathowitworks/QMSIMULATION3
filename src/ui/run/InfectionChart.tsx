// The weekly infection curves (the "do nothing" baseline and the chosen policy).
// The drawing is done by WeeklyChart; this only gives it the infection labels.

import WeeklyChart from './WeeklyChart'

interface Props {
  baselineWeekly: number[]
  policyWeekly: number[]
}

export default function InfectionChart({ baselineWeekly, policyWeekly }: Props) {
  return (
    <WeeklyChart
      baselineWeekly={baselineWeekly}
      policyWeekly={policyWeekly}
      sectionLabel="Infection curve"
      svgLabel="Weekly infections: do-nothing baseline compared with your policy"
      yTitle="Infections per week"
    />
  )
}