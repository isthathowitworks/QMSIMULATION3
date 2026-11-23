// The box under a household dots card that shows the households of one municipality (6.3e): how many
// households it has and how many are susceptible, exposed, infectious and recovered at the shown week.
// It only shows what it is given. With no municipality chosen it shows a hint.
// Its styles are in MunicipalityMap.css (the same box as under the colored maps) and HouseholdDots.css.

import type { MunicipalityHouseholds } from '../../state/householdCounts'

interface Props {
  counts: MunicipalityHouseholds | null
}

// A whole number with thousands separators, for example 1,234.
function countLabel(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '0'
}

export default function HouseholdDetailsBox({ counts }: Props) {
  return (
    <div className="map-details map-details-households" aria-live="polite">
      {counts === null ? (
        <p className="map-details-hint">Hover over, focus or tap a municipality to see its households.</p>
      ) : (
        <>
          <h4 className="map-details-name">{counts.name}</h4>
          <dl className="map-details-list">
            <div>
              <dt>Households</dt>
              <dd>{countLabel(counts.households)}</dd>
            </div>
            <div>
              <dt>Susceptible</dt>
              <dd>{countLabel(counts.susceptible)}</dd>
            </div>
            <div>
              <dt>Exposed</dt>
              <dd>{countLabel(counts.exposed)}</dd>
            </div>
            <div>
              <dt>Infectious</dt>
              <dd>{countLabel(counts.infectious)}</dd>
            </div>
            <div>
              <dt>Recovered</dt>
              <dd>{countLabel(counts.recovered)}</dd>
            </div>
          </dl>
        </>
      )}
    </div>
  )
}