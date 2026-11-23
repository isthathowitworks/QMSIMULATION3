// What the page shows after a run: the headline number (how much lower the infections
// are than with "do nothing"), the infection curve, and the adult and immature mosquitoes
// per person. It shows nothing until there is a comparison.

import type { Comparison } from '../../state/curve'
import HeadlineNumber from './HeadlineNumber'
import InfectionChart from './InfectionChart'
import MosquitoChart from './MosquitoChart'

interface Props {
  comparison: Comparison | null
}

export default function ResultsPanel({ comparison }: Props) {
  if (comparison === null) return null

  return (
    <section className="results" aria-label="Results">
      <HeadlineNumber percentReduction={comparison.percentReduction} />
      <InfectionChart baselineWeekly={comparison.baselineWeekly} policyWeekly={comparison.policyWeekly} />
      <MosquitoChart
        kind="adults"
        baselineWeekly={comparison.baselineAdultsPerPerson}
        policyWeekly={comparison.policyAdultsPerPerson}
      />
      <MosquitoChart
        kind="immatures"
        baselineWeekly={comparison.baselineImmaturesPerPerson}
        policyWeekly={comparison.policyImmaturesPerPerson}
      />
    </section>
  )
}