// Draws one map of the 12 municipalities as a plain SVG, colored by one value per municipality
// (bite infections per 1,000 simulated people, summed over the whole run), with a legend bar under it.
// It only draws what it is given. `names` and `values` are in the same order, and `max` is the top of the
// color scale, shared by every map on the page so the same color means the same number.

import { useMemo } from 'react'
import './MunicipalityMap.css'
import type { MapData } from '../../state/loadMap'
import { colorFor, DARKEST, LIGHTEST } from './colorScale'
import { shapePaths } from './mapGeometry'

interface Props {
  map: MapData
  names: string[]
  values: number[]
  max: number
  title: string
  svgLabel: string
}

const WIDTH = 400
const HEIGHT = 360
const MIDDLE = colorFor(1, 2)

// A label with at most three significant digits and no floating point noise.
function numberLabel(value: number): string {
  return Number.isFinite(value) && value > 0 ? String(Number(value.toPrecision(3))) : '0'
}

export default function MunicipalityMap({ map, names, values, max, title, svgLabel }: Props) {
  const paths = useMemo(() => shapePaths(map, WIDTH, HEIGHT), [map])
  if (paths.length === 0) return <p className="chart-note">No map to show yet.</p>

  const valueByName = new Map<string, number>()
  names.forEach((name, i) => valueByName.set(name, values[i]))

  return (
    <section className="map-card" aria-label={title}>
      <h3 className="map-title">{title}</h3>
      <svg className="map-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={svgLabel}>
        {paths.map((p) =>
          valueByName.has(p.name) ? (
            <path
              key={p.name}
              className="map-shape"
              data-municipality={p.name}
              d={p.d}
              fill={colorFor(valueByName.get(p.name) ?? 0, max)}
            />
          ) : (
            <path key={p.name} className="map-shape map-shape-missing" data-municipality={p.name} d={p.d} />
          ),
        )}
      </svg>

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