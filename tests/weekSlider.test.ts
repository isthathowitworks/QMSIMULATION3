import { createElement } from 'react'
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import WeekSlider from '../src/ui/map/WeekSlider'

type Props = ComponentProps<typeof WeekSlider>

function render(over: Partial<Props> = {}): string {
  const props: Props = {
    week: 3,
    weeks: 10,
    playing: false,
    onWeekChange: () => {},
    onPlayPause: () => {},
    ...over,
  }
  return renderToStaticMarkup(createElement(WeekSlider, props))
}

describe('WeekSlider', () => {
  it('shows Play when paused and Pause when playing', () => {
    expect(render({ playing: false })).toContain('>Play</button>')
    expect(render({ playing: true })).toContain('>Pause</button>')
  })

  it('shows the week it is on and the number of weeks', () => {
    expect(render({ week: 3, weeks: 10 })).toContain('>Week 4 of 10</span>')
  })

  it('draws a slider from week 0 to the last week, on the week it is given', () => {
    const markup = render({ week: 3, weeks: 10 })
    expect(markup).toContain('type="range"')
    expect(markup).toContain('min="0"')
    expect(markup).toContain('max="9"')
    expect(markup).toContain('value="3"')
  })

  it('gives the slider a label', () => {
    expect(render()).toContain('aria-label="Week of the run"')
  })

  it('keeps the week it shows inside the run', () => {
    const markup = render({ week: 99, weeks: 10 })
    expect(markup).toContain('value="9"')
    expect(markup).toContain('>Week 10 of 10</span>')
  })

  it('shows a note and no slider when there are no weeks', () => {
    const markup = render({ weeks: 0 })
    expect(markup).toContain('No weeks to show yet.')
    expect(markup).not.toContain('<input')
    expect(markup).not.toContain('<button')
  })

  it('turns the button off when there is only one week, and on otherwise', () => {
    expect(render({ week: 0, weeks: 1 })).toContain('disabled')
    expect(render({ week: 0, weeks: 10 })).not.toContain('disabled')
  })

  it('has no NaN and nothing undefined', () => {
    const markup = render({ week: Number.NaN })
    expect(markup).not.toContain('NaN')
    expect(markup).not.toContain('undefined')
  })
})