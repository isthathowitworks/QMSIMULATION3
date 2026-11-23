// What the page shows after a run: for now the infection curve.
// It shows nothing until there is a comparison (the headline number and the
// mosquito counts come in later steps).

import type { Comparison } from '../../state/curve'
import InfectionChart from './InfectionChart'

interface Props {
  comparison: Comparison | null
}

export default function ResultsPanel({ comparison }: Props) {
  if (comparison === null) return null

  return (
    <section className="results" aria-label="Results">
      <InfectionChart baselineWeekly={comparison.baselineWeekly} policyWeekly={comparison.policyWeekly} />
    </section>
  )
}