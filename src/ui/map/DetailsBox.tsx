// The box under a map that shows the details of one municipality (6.3): name, people in the simulation,
// bite infections over the whole run and bite infections per 1,000 people. It only shows what it is
// given. With no municipality chosen it shows a hint. Its CSS is in MunicipalityMap.css.

import type { MunicipalityDetails } from '../../state/municipalities'

interface Props {
  details: MunicipalityDetails | null
}

// A whole number with thousands separators, for example 18,986.
function countLabel(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '0'
}

// At most three significant digits and no floating point noise, same as the legend.
function rateLabel(value: number): string {
  return Number.isFinite(value) && value > 0 ? String(Number(value.toPrecision(3))) : '0'
}

export default function DetailsBox({ details }: Props) {
  return (
    <div className="map-details" aria-live="polite">
      {details === null ? (
        <p className="map-details-hint">Hover over, focus or tap a municipality to see its details.</p>
      ) : (
        <>
          <h4 className="map-details-name">{details.name}</h4>
          <dl className="map-details-list">
            <div>
              <dt>People in the simulation</dt>
              <dd>{countLabel(details.people)}</dd>
            </div>
            <div>
              <dt>Bite infections over the whole run</dt>
              <dd>{countLabel(details.infections)}</dd>
            </div>
            <div>
              <dt>Bite infections per 1,000 people</dt>
              <dd>{rateLabel(details.perThousand)}</dd>
            </div>
          </dl>
        </>
      )}
    </div>
  )
}