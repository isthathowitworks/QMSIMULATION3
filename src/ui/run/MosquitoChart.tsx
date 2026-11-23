// The weekly mosquitoes per person for the "do nothing" baseline and the chosen policy.
// The drawing is done by WeeklyChart; this only gives it the mosquito labels.

import WeeklyChart from './WeeklyChart'

type Kind = 'adults' | 'immatures'

interface Props {
  kind: Kind
  baselineWeekly: number[]
  policyWeekly: number[]
}

const TEXT: Record<Kind, { section: string; svg: string; yTitle: string }> = {
  adults: {
    section: 'Adult mosquitoes',
    svg: 'Adult mosquitoes per person, weekly average: do-nothing baseline compared with your policy',
    yTitle: 'Adult mosquitoes per person',
  },
  immatures: {
    section: 'Immature mosquitoes',
    svg: 'Immature mosquitoes per person, weekly average: do-nothing baseline compared with your policy',
    yTitle: 'Immature mosquitoes per person',
  },
}

export default function MosquitoChart({ kind, baselineWeekly, policyWeekly }: Props) {
  const text = TEXT[kind]
  return (
    <WeeklyChart
      baselineWeekly={baselineWeekly}
      policyWeekly={policyWeekly}
      sectionLabel={text.section}
      svgLabel={text.svg}
      yTitle={text.yTitle}
    />
  )
}