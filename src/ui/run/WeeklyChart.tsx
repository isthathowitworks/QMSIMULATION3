// Draws two weekly curves (the "do nothing" baseline and the chosen policy) as a plain SVG.
// It only draws what it is given. The labels come in as props, so the same chart is used for
// infections and for mosquitoes per person.

import './InfectionChart.css'

interface Props {
  baselineWeekly: number[]
  policyWeekly: number[]
  sectionLabel: string
  svgLabel: string
  yTitle: string
}

const WIDTH = 720
const HEIGHT = 300
const LEFT = 52
const RIGHT = 16
const TOP = 16
const BOTTOM = 44
const PLOT_W = WIDTH - LEFT - RIGHT
const PLOT_H = HEIGHT - TOP - BOTTOM
const WEEKS_PER_LABEL = 52
const NICE = [1, 2, 4, 6, 8, 10]

// Zero for anything that is not a finite number, and never below zero.
function clean(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function maxOf(values: number[]): number {
  let max = 0
  for (const v of values) max = Math.max(max, clean(v))
  return max
}

// Rounds the top of the axis up to 1, 2, 4, 6, 8 or 10 times a power of 10.
function niceMax(max: number): number {
  if (!(max > 0)) return 1
  const exp = 10 ** Math.floor(Math.log10(max))
  const step = NICE.find((n) => max <= n * exp) ?? 10
  return step * exp
}

// A tick label with at most three significant digits and no floating point noise.
function tickLabel(value: number): string {
  return String(Number(value.toPrecision(3)))
}

function xOf(index: number, count: number): number {
  return count <= 1 ? LEFT + PLOT_W / 2 : LEFT + (index / (count - 1)) * PLOT_W
}

function yOf(value: number, yMax: number): number {
  return TOP + PLOT_H - (clean(value) / yMax) * PLOT_H
}

function pointsOf(values: number[], count: number, yMax: number): string {
  return values.map((v, i) => `${xOf(i, count).toFixed(1)},${yOf(v, yMax).toFixed(1)}`).join(' ')
}

export default function WeeklyChart({ baselineWeekly, policyWeekly, sectionLabel, svgLabel, yTitle }: Props) {
  const count = Math.max(baselineWeekly.length, policyWeekly.length)
  if (count === 0) return <p className="chart-note">No curve to show yet.</p>

  const yMax = niceMax(Math.max(maxOf(baselineWeekly), maxOf(policyWeekly)))
  const yTicks = yMax >= 2 ? [0, yMax / 2, yMax] : [0, yMax]
  const weekLabels: number[] = []
  for (let w = 0; w < count; w += WEEKS_PER_LABEL) weekLabels.push(w)

  return (
    <section className="chart" aria-label={sectionLabel}>
      <svg className="chart-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={svgLabel}>
        {yTicks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={LEFT} x2={WIDTH - RIGHT} y1={yOf(t, yMax)} y2={yOf(t, yMax)} />
            <text className="chart-text" x={LEFT - 6} y={yOf(t, yMax) + 4} textAnchor="end">
              {tickLabel(t)}
            </text>
          </g>
        ))}

        {weekLabels.map((w) => (
          <text key={w} className="chart-text" x={xOf(w, count)} y={TOP + PLOT_H + 16} textAnchor="middle">
            {String(w)}
          </text>
        ))}

        <text className="chart-title" x={LEFT + PLOT_W / 2} y={HEIGHT - 6} textAnchor="middle">
          Week of the run
        </text>
        <text
          className="chart-title"
          x={14}
          y={TOP + PLOT_H / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${TOP + PLOT_H / 2})`}
        >
          {yTitle}
        </text>

        <polyline className="chart-line chart-line-baseline" points={pointsOf(baselineWeekly, count, yMax)} />
        <polyline className="chart-line chart-line-policy" points={pointsOf(policyWeekly, count, yMax)} />
      </svg>

      <ul className="chart-legend">
        <li>
          <span className="chart-swatch chart-swatch-baseline" />
          Do nothing
        </li>
        <li>
          <span className="chart-swatch" />
          Your policy
        </li>
      </ul>
    </section>
  )
}