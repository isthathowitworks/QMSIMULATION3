// What the page shows after a run: the headline number (how much lower the infections
// are than with "do nothing"), the infection curve, the two maps of bite infections per municipality,
// the adult and immature mosquitoes per person, and the note about how to read the size of the reduction.
// It shows nothing until there is a comparison. If the map files are still loading or could not be
// loaded, only the map spot shows a short note: the headline number and the charts are not affected.

import type { Comparison } from '../../state/curve'
import { mapColumns } from '../../state/mapData'
import type { MapDataState } from '../../state/useMapData'
import MapPair from '../map/MapPair'
import HeadlineNumber from './HeadlineNumber'
import InfectionChart from './InfectionChart'
import MosquitoChart from './MosquitoChart'
import ResultsNote from './ResultsNote'

interface Props {
  comparison: Comparison | null
  mapState: MapDataState
}

function MapArea({ comparison, mapState }: { comparison: Comparison; mapState: MapDataState }) {
  if (mapState.status === 'loading') return <p className="chart-note">Loading the map.</p>
  if (mapState.status === 'failed') {
    return (
      <p className="chart-note">
        The map could not be loaded ({mapState.message}). The numbers and charts are not affected.
      </p>
    )
  }
  const columns = mapColumns(comparison, mapState.files.population)
  if (columns === null) {
    return <p className="chart-note">The map does not match the number of municipalities in this run, so it is not shown.</p>
  }
  return <MapPair map={mapState.files.map} columns={columns} />
}

export default function ResultsPanel({ comparison, mapState }: Props) {
  if (comparison === null) return null

  return (
    <section className="results" aria-label="Results">
      <HeadlineNumber percentReduction={comparison.percentReduction} />
      <InfectionChart baselineWeekly={comparison.baselineWeekly} policyWeekly={comparison.policyWeekly} />
      <MapArea comparison={comparison} mapState={mapState} />
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
      <ResultsNote kind="afterRun" />
    </section>
  )
}