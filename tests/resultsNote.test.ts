import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ResultsNote from '../src/ui/run/ResultsNote'

function render(kind: 'always' | 'afterRun'): string {
  return renderToStaticMarkup(createElement(ResultsNote, { kind }))
}

describe('ResultsNote', () => {
  it('shows the always-visible note', () => {
    const markup = render('always')
    expect(markup).toContain('This tool compares strategies.')
    expect(markup).toContain('It does not forecast case counts.')
    expect(markup).toContain('The biological rates are assumptions.')
  })

  it('shows the after-a-run note', () => {
    const markup = render('afterRun')
    expect(markup).toContain('fitted to real cases while the real policy')
    expect(markup).toContain('weekly cleaning, fogging at 1 case')
    expect(markup).toContain('Doing nothing is outside what the fit saw')
    expect(markup).toContain('read the size of the reduction with care')
  })

  it('does not mix up the two notes', () => {
    expect(render('always')).not.toContain('fitted')
    expect(render('afterRun')).not.toContain('does not forecast')
  })

  it('is marked as a note for screen readers and has its own class', () => {
    expect(render('always')).toContain('role="note"')
    expect(render('always')).toContain('results-note-always')
    expect(render('afterRun')).toContain('role="note"')
    expect(render('afterRun')).toContain('results-note-after-run')
  })
})