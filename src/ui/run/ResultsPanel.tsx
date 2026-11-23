// What the page shows after a run: the headline number (how much lower the infections
// are than with "do nothing") and the infection curve.
// It shows nothing until there is a comparison (the mosquito counts come in a later step).

import type { Comparison } from '../../state/curve'
import HeadlineNumber from './HeadlineNumber'
import InfectionChart from './InfectionChart'

interface Props {
  comparison: Comparison | null
}

export default function ResultsPanel({ comparison }: Props) {
  if (comparison === null) return null

  return (
    <section className="results" aria-label="Results">
      <HeadlineNumber percentReduction={comparison.percentReduction} />
      <InfectionChart baselineWeekly={comparison.baselineWeekly} policyWeekly={comparison.policyWeekly} />
    </section>
  )
}