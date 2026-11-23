// One color scale for the maps: light for few bite infections per 1,000 people, dark for many.
// Both maps use the same top value (sharedMax), so the same color means the same number on both.

// Three steps: light, middle, dark (RGB).
const STOPS: [number, number, number][] = [
  [255, 245, 235],
  [253, 141, 60],
  [127, 39, 4],
]

function hex(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0')
}

// The color for `value` on a scale from 0 to `max`. Values above `max` get the darkest color.
// Anything that is not a finite number, anything below 0, and a `max` of 0 or less give the lightest color.
export function colorFor(value: number, max: number): string {
  const t = Number.isFinite(value) && Number.isFinite(max) && max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const pos = t * (STOPS.length - 1)
  const i = Math.min(Math.floor(pos), STOPS.length - 2)
  const f = pos - i
  const from = STOPS[i]
  const to = STOPS[i + 1]
  const channels = [0, 1, 2].map((c) => hex(from[c] + (to[c] - from[c]) * f))
  return `#${channels.join('')}`
}

// The largest value in all the lists, so that every map is colored on the same scale.
// Values that are not finite numbers or are below 0 are ignored. It is 0 when there is nothing to count.
export function sharedMax(...lists: number[][]): number {
  let max = 0
  for (const list of lists) {
    for (const v of list) {
      if (Number.isFinite(v) && v > max) max = v
    }
  }
  return max
}

export const LIGHTEST = colorFor(0, 1)
export const DARKEST = colorFor(1, 1)