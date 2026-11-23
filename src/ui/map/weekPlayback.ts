// The rules of the week slider and its play button, as plain functions (no React, no timer), so they can
// be tested on their own. A "week" is a row of the household states: week 0 is day 0, then one row every
// 7 days. `weeks` is the number of rows, so the last week is weeks - 1.

export interface Playback {
  week: number
  playing: boolean
}

// The last week of a run with `weeks` weeks. With no weeks (or a number of weeks that is not a number) it is 0.
function lastWeek(weeks: number): number {
  return Number.isFinite(weeks) && weeks >= 1 ? Math.floor(weeks) - 1 : 0
}

// A week the slider can show: a whole number from 0 to the last week. A week that is not a number, or a
// run with no weeks, gives 0.
export function clampWeek(week: number, weeks: number): number {
  if (!Number.isFinite(week)) return 0
  return Math.min(lastWeek(weeks), Math.max(0, Math.round(week)))
}

// What happens each time the timer ticks while playing: one week on, and play stops on the last week.
export function tick(week: number, weeks: number): Playback {
  const current = clampWeek(week, weeks)
  const last = lastWeek(weeks)
  if (current >= last) return { week: last, playing: false }
  const next = current + 1
  return { week: next, playing: next < last }
}

// What the play and pause button does. While playing it pauses. When paused it plays from the current
// week, or from week 0 when the run is on its last week. With fewer than two weeks there is nothing to play.
export function pressPlayPause(week: number, weeks: number, playing: boolean): Playback {
  const current = clampWeek(week, weeks)
  const last = lastWeek(weeks)
  if (last < 1) return { week: current, playing: false }
  if (playing) return { week: current, playing: false }
  if (current >= last) return { week: 0, playing: true }
  return { week: current, playing: true }
}