// Draws one dot per household for the two runs side by side ("do nothing" on the left, your policy on
// the right), colored by the highest state in the household at one week of the run.
// The dots are drawn as one path per state (round, zero-length segments), so about 7,600 dots stay fast.
// The positions are made-up points inside each municipality, NOT real house locations, and the page says so.
// It only draws what it is given: `width` and `height` must be the box the positions were made for
// (the same numbers that were given to dotPositions), and `snapshot` is the week (row of the states).
// With `municipalityOf` (the municipality index of each household, in world order) and `names` (6.3e) the
// pale municipality outlines can be hovered, focused or tapped: a box under each card then shows the
// households of that municipality in each state at the shown week, for that card's own run. One choice is
// shared by both cards, so the same municipality is outlined on both. Hover and focus last as long as they
// do; a click, tap, Enter or Space pins the municipality until the same one is chosen again.

import { useMemo, useState } from 'react'
import type { SVGProps } from 'react'
import './HouseholdDots.css'
import './MapPair.css'
import './MunicipalityMap.css'
import { householdSnapshots } from '../../state/curve'
import { householdStateCounts } from '../../state/householdCounts'
import type { MunicipalityHouseholds } from '../../state/householdCounts'
import type { MapData } from '../../state/loadMap'
import HouseholdDetailsBox from './HouseholdDetailsBox'
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
  municipalityOf?: ArrayLike<number> // one entry per household, in world order: index into names
  names?: string[] // municipality names, in the order of first appearance (same as World.municipalities)
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

// The choice of municipality, held by HouseholdDots and shared by both cards.
interface Choice {
  shownName: string | null // hovered or focused, else pinned
  pinned: string | null
  onHover: (name: string | null) => void
  onToggle: (name: string) => void
}

interface CardProps {
  title: string
  svgLabel: string
  outlines: { name: string; d: string }[]
  parts: string[][]
  width: number
  height: number
  counts: MunicipalityHouseholds[] | null // null: no details on this card
  choice: Choice
}

function DotCard({ title, svgLabel, outlines, parts, width, height, counts, choice }: CardProps) {
  const countByName = new Map<string, MunicipalityHouseholds>()
  for (const c of counts ?? []) countByName.set(c.name, c)
  const shown = choice.shownName === null ? null : (countByName.get(choice.shownName) ?? null)

  // What makes an outline hoverable, focusable and tappable. Empty for an outline with no counts.
  function outlineProps(name: string): SVGProps<SVGPathElement> {
    const entry = countByName.get(name)
    if (!entry) return {}
    return {
      tabIndex: 0,
      role: 'button',
      'aria-label': `${name}: ${entry.households} households`,
      'aria-pressed': choice.pinned === name,
      onMouseEnter: () => choice.onHover(name),
      onMouseLeave: () => choice.onHover(null),
      onFocus: () => choice.onHover(name),
      onBlur: () => choice.onHover(null),
      onClick: () => choice.onToggle(name),
      onKeyDown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          choice.onToggle(name)
        }
      },
    }
  }

  return (
    <section className="map-card" aria-label={title}>
      <h3 className="map-title">{title}</h3>
      <svg
        className="map-svg"
        viewBox={`0 0 ${width} ${height}`}
        role={counts === null ? 'img' : 'group'}
        aria-label={svgLabel}
      >
        {outlines.map((o) => (
          <path
            key={o.name}
            className={o.name === choice.shownName && countByName.has(o.name) ? 'dots-shape dots-shape-active' : 'dots-shape'}
            data-municipality={o.name}
            d={o.d}
            {...outlineProps(o.name)}
          />
        ))}
        {DRAW_ORDER.map((s) =>
          parts[s.code].length > 0 ? (
            <path key={s.id} className={`dots-dot dots-dot-${s.id}`} d={parts[s.code].join('')} />
          ) : null,
        )}
      </svg>

      {counts !== null && <HouseholdDetailsBox counts={shown} />}

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
  municipalityOf,
  names,
}: Props) {
  const outlines = useMemo(() => shapePaths(map, width, height), [map, width, height])
  const [hovered, setHovered] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
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

  // The details need the household-to-municipality list and the names, and both runs must give counts.
  // If either one does not fit, neither card gets details (the dots are still drawn).
  const fits = municipalityOf !== undefined && names !== undefined && municipalityOf.length === householdCount
  const baselineCounts = fits ? householdStateCounts(municipalityOf, names, baselineStates, snapshot) : null
  const policyCounts = fits ? householdStateCounts(municipalityOf, names, policyStates, snapshot) : null
  const withDetails = baselineCounts !== null && policyCounts !== null

  const choice: Choice = {
    shownName: hovered ?? pinned,
    pinned,
    onHover: setHovered,
    onToggle: (name) => setPinned(pinned === name ? null : name),
  }

  return (
    <section className="map-pair" aria-label="Household dots">
      <DotCard
        title="Do nothing"
        svgLabel="Map of households, each dot colored by the highest state in the household, with no cleaning and no fogging"
        outlines={outlines}
        parts={baseline}
        width={width}
        height={height}
        counts={withDetails ? baselineCounts : null}
        choice={choice}
      />
      <DotCard
        title="Your policy"
        svgLabel="Map of households, each dot colored by the highest state in the household, with your policy"
        outlines={outlines}
        parts={policy}
        width={width}
        height={height}
        counts={withDetails ? policyCounts : null}
        choice={choice}
      />
      <p className="dots-note">
        The dots are made-up positions inside each municipality, not real house locations.
      </p>
    </section>
  )
}