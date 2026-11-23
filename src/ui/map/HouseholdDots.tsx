// Draws one dot per household for the two runs side by side ("do nothing" on the left, your policy on
// the right), colored by the highest state in the household at one week of the run.
// The dots are drawn as one path per state (round, zero-length segments), so about 7,600 dots stay fast.
// The positions are made-up points inside each municipality, NOT real house locations, and the page says so.
// It only draws what it is given: `width` and `height` must be the box the positions were made for
// (the same numbers that were given to dotPositions), and `snapshot` is the week (row of the states).

import { useMemo } from 'react'
import './HouseholdDots.css'
import './MapPair.css'
import './MunicipalityMap.css'
import { householdSnapshots } from '../../state/curve'
import type { MapData } from '../../state/loadMap'
import type { HouseholdPositions } from './householdPositions'
import { shapePaths } from './mapGeometry'

interface Props {
  map: MapData
  positions: HouseholdPositions // one position per household, in world order
  householdCount: number
  baselineStates: Uint8Array // flat: row = snapshot (week), column = household; 0 to 3
  policyStates: Uint8Array
  snapshot: number // the week to show: a whole number from 0 to the number of snapshots - 1
  width: number
  height: number
}

// Legend order: the highest state first. The dots are drawn in the opposite order, so the infected dots
// end up on top.
const STATES = [
  { code: 2, id: 'infectious', label: 'Infectious' },
  { code: 1, id: 'exposed', label: 'Exposed' },
  { code: 3, id: 'recovered', label: 'Recovered' },
  { code: 0, id: 'susceptible', label: 'Susceptible' },
]
const DRAW_ORDER = [...STATES].reverse()

// For each state code, the path data of its dots in the given snapshot (one segment per household).
function groupDots(positions: HouseholdPositions, states: Uint8Array, offset: number, count: number): string[][] {
  const parts: string[][] = [[], [], [], []]
  for (let h = 0; h < count; h++) {
    const group = parts[states[offset + h]]
    if (group) group.push(`M${positions.x[h].toFixed(1)} ${positions.y[h].toFixed(1)}h0`)
  }
  return parts
}

interface CardProps {
  title: string
  svgLabel: string
  outlines: { name: string; d: string }[]
  parts: string[][]
  width: number
  height: number
}

function DotCard({ title, svgLabel, outlines, parts, width, height }: CardProps) {
  return (
    <section className="map-card" aria-label={title}>
      <h3 className="map-title">{title}</h3>
      <svg className="map-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={svgLabel}>
        {outlines.map((o) => (
          <path key={o.name} className="dots-shape" data-municipality={o.name} d={o.d} />
        ))}
        {DRAW_ORDER.map((s) =>
          parts[s.code].length > 0 ? (
            <path key={s.id} className={`dots-dot dots-dot-${s.id}`} d={parts[s.code].join('')} />
          ) : null,
        )}
      </svg>

      <p className="dots-legend-title">Highest state in the household</p>
      <ul className="dots-legend">
        {STATES.map((s) => (
          <li key={s.id}>
            <span className={`dots-swatch dots-swatch-${s.id}`} />
            <span>{`${s.label}: ${parts[s.code].length}`}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function HouseholdDots({
  map,
  positions,
  householdCount,
  baselineStates,
  policyStates,
  snapshot,
  width,
  height,
}: Props) {
  const outlines = useMemo(() => shapePaths(map, width, height), [map, width, height])
  const snapshots = householdSnapshots(baselineStates, householdCount)
  const valid =
    outlines.length > 0 &&
    householdCount > 0 &&
    positions.x.length === householdCount &&
    positions.y.length === householdCount &&
    Number.isInteger(snapshots) &&
    snapshots > 0 &&
    policyStates.length === baselineStates.length &&
    Number.isInteger(snapshot) &&
    snapshot >= 0 &&
    snapshot < snapshots
  if (!valid) return <p className="chart-note">No household dots to show yet.</p>

  const offset = snapshot * householdCount
  const baseline = groupDots(positions, baselineStates, offset, householdCount)
  const policy = groupDots(positions, policyStates, offset, householdCount)

  return (
    <section className="map-pair" aria-label="Household dots">
      <DotCard
        title="Do nothing"
        svgLabel="Map of households, each dot colored by the highest state in the household, with no cleaning and no fogging"
        outlines={outlines}
        parts={baseline}
        width={width}
        height={height}
      />
      <DotCard
        title="Your policy"
        svgLabel="Map of households, each dot colored by the highest state in the household, with your policy"
        outlines={outlines}
        parts={policy}
        width={width}
        height={height}
      />
      <p className="dots-note">
        The dots are made-up positions inside each municipality, not real house locations.
      </p>
    </section>
  )
}