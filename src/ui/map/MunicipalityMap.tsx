// Draws one map of the 12 municipalities as a plain SVG, colored by one value per municipality
// (bite infections per 1,000 simulated people, summed over the whole run), with a legend bar under it.
// It only draws what it is given. `names` and `values` are in the same order, and `max` is the top of the
// color scale, shared by every map on the page so the same color means the same number.
// With `details` (6.3) the shapes can be hovered, focused or tapped: a box under the map then shows the
// name, people and infections of that municipality. Hover and focus show it for as long as they last;
// a click, tap, Enter or Space pins it until the same shape is chosen again.

import { useMemo, useState } from 'react'
import type { SVGProps } from 'react'
import './MunicipalityMap.css'
import type { MapData } from '../../state/loadMap'
import type { MunicipalityDetails } from '../../state/municipalities'
import { colorFor, DARKEST, LIGHTEST } from './colorScale'
import DetailsBox from './DetailsBox'
import { shapePaths } from './mapGeometry'

interface Props {
  map: MapData
  names: string[]
  values: number[]
  max: number
  title: string
  svgLabel: string
  details?: MunicipalityDetails[]
}

const WIDTH = 400
const HEIGHT = 360
const MIDDLE = colorFor(1, 2)

// A label with at most three significant digits and no floating point noise.
function numberLabel(value: number): string {
  return Number.isFinite(value) && value > 0 ? String(Number(value.toPrecision(3))) : '0'
}

export default function MunicipalityMap({ map, names, values, max, title, svgLabel, details = [] }: Props) {
  const paths = useMemo(() => shapePaths(map, WIDTH, HEIGHT), [map])
  const [hovered, setHovered] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  if (paths.length === 0) return <p className="chart-note">No map to show yet.</p>

  const valueByName = new Map<string, number>()
  names.forEach((name, i) => valueByName.set(name, values[i]))

  const detailByName = new Map<string, MunicipalityDetails>()
  for (const d of details) detailByName.set(d.name, d)
  const hasDetails = detailByName.size > 0

  const shownName = hovered ?? pinned
  const shown = shownName === null ? null : (detailByName.get(shownName) ?? null)

  function togglePinned(name: string) {
    setPinned(pinned === name ? null : name)
  }

  // What makes a shape hoverable, focusable and tappable. Empty for a shape with no details.
  function interactiveProps(name: string): SVGProps<SVGPathElement> {
    const detail = detailByName.get(name)
    if (!detail) return {}
    return {
      tabIndex: 0,
      role: 'button',
      'aria-label': `${name}: ${numberLabel(detail.perThousand)} bite infections per 1,000 people`,
      'aria-pressed': pinned === name,
      onMouseEnter: () => setHovered(name),
      onMouseLeave: () => setHovered(null),
      onFocus: () => setHovered(name),
      onBlur: () => setHovered(null),
      onClick: () => togglePinned(name),
      onKeyDown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          togglePinned(name)
        }
      },
    }
  }

  function shapeClass(name: string, missing: boolean): string {
    let className = 'map-shape'
    if (missing) className += ' map-shape-missing'
    if (name === shownName && detailByName.has(name)) className += ' map-shape-active'
    return className
  }

  return (
    <section className="map-card" aria-label={title}>
      <h3 className="map-title">{title}</h3>
      <svg
        className="map-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role={hasDetails ? 'group' : 'img'}
        aria-label={svgLabel}
      >
        {paths.map((p) =>
          valueByName.has(p.name) ? (
            <path
              key={p.name}
              className={shapeClass(p.name, false)}
              data-municipality={p.name}
              d={p.d}
              fill={colorFor(valueByName.get(p.name) ?? 0, max)}
              {...interactiveProps(p.name)}
            />
          ) : (
            <path
              key={p.name}
              className={shapeClass(p.name, true)}
              data-municipality={p.name}
              d={p.d}
              {...interactiveProps(p.name)}
            />
          ),
        )}
      </svg>

      {hasDetails && <DetailsBox details={shown} />}

      <div className="map-legend">
        <div
          className="map-legend-bar"
          style={{ background: `linear-gradient(to right, ${LIGHTEST}, ${MIDDLE}, ${DARKEST})` }}
        />
        <div className="map-legend-labels">
          <span>0</span>
          <span>{numberLabel(max)}</span>
        </div>
        <p className="map-legend-title">Bite infections per 1,000 people over the whole run</p>
      </div>
    </section>
  )
}