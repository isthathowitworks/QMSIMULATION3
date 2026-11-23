// A play and pause button and a slider for the week of the run, for the household dots.
// It only draws what it is given: the page holds the week and whether it is playing, and says what to do
// when the slider is moved (onWeekChange) or the button is pressed (onPlayPause).
// `weeks` is the number of weeks (rows of household states); the slider goes from week 0 to the last one.

import './WeekSlider.css'
import { clampWeek } from './weekPlayback'

interface Props {
  week: number
  weeks: number
  playing: boolean
  onWeekChange: (week: number) => void
  onPlayPause: () => void
}

export default function WeekSlider({ week, weeks, playing, onWeekChange, onPlayPause }: Props) {
  if (!Number.isInteger(weeks) || weeks < 1) return <p className="chart-note">No weeks to show yet.</p>
  const shown = clampWeek(week, weeks)

  return (
    <div className="week-slider" role="group" aria-label="Week control">
      <button type="button" className="week-slider-button" disabled={weeks < 2} onClick={onPlayPause}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <input
        type="range"
        className="week-slider-range"
        min={0}
        max={weeks - 1}
        step={1}
        value={shown}
        aria-label="Week of the run"
        onChange={(event) => onWeekChange(Number(event.target.value))}
      />
      <span className="week-slider-label">{`Week ${shown + 1} of ${weeks}`}</span>
    </div>
  )
}