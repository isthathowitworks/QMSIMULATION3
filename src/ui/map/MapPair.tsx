// The two maps side by side: "do nothing" on the left and your policy on the right.
// Both use the same top value for the colors, so the same color means the same number on both and the
// effect of the policy shows as lighter colors. It only draws what it is given.

import './MapPair.css'
import type { MapData } from '../../state/loadMap'
import type { MapColumns } from '../../state/mapData'
import { sharedMax } from './colorScale'
import MunicipalityMap from './MunicipalityMap'

interface Props {
  map: MapData
  columns: MapColumns
}

export default function MapPair({ map, columns }: Props) {
  const max = sharedMax(columns.baseline, columns.policy)

  return (
    <section className="map-pair" aria-label="Maps of the municipalities">
      <MunicipalityMap
        map={map}
        names={columns.names}
        values={columns.baseline}
        max={max}
        title="Do nothing"
        svgLabel="Map of bite infections per 1,000 people in each municipality with no cleaning and no fogging"
      />
      <MunicipalityMap
        map={map}
        names={columns.names}
        values={columns.policy}
        max={max}
        title="Your policy"
        svgLabel="Map of bite infections per 1,000 people in each municipality with your policy"
      />
    </section>
  )
}