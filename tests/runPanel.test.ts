import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import RunPanel from '../src/ui/run/RunPanel'
import type { RunStatus } from '../src/ui/run/RunPanel'

function render(status: RunStatus, extra: { daysDone?: number; totalDays?: number; message?: string } = {}): string {
  return renderToStaticMarkup(
    createElement(RunPanel, {
      status,
      daysDone: 0,
      totalDays: 0,
      onRun() {},
      onCancel() {},
      ...extra,
    }),
  )
}

function buttonTag(markup: string, className: string): string {
  const match = markup.match(new RegExp(`<button[^>]*class="${className}"[^>]*>`))
  if (!match) throw new Error(`no button with class ${className}`)
  return match[0]
}

describe('RunPanel', () => {
  it('idle: Run is enabled, Cancel is disabled, no progress bar', () => {
    const markup = render('idle')
    expect(buttonTag(markup, 'run-button')).not.toContain('disabled')
    expect(buttonTag(markup, 'cancel-button')).toContain('disabled')
    expect(markup).not.toContain('<progress')
  })

  it('running: Run is disabled, Cancel is enabled, progress bar shows the day', () => {
    const markup = render('running', { daysDone: 300, totalDays: 2000 })
    expect(buttonTag(markup, 'run-button')).toContain('disabled')
    expect(buttonTag(markup, 'cancel-button')).not.toContain('disabled')
    expect(markup).toContain('<progress')
    expect(markup).toContain('value="300"')
    expect(markup).toContain('max="2000"')
    expect(markup).toContain('Day 300 of 2000')
  })

  it('done: shows that the run finished and both buttons are back to idle', () => {
    const markup = render('done')
    expect(markup).toContain('Run finished.')
    expect(buttonTag(markup, 'run-button')).not.toContain('disabled')
    expect(buttonTag(markup, 'cancel-button')).toContain('disabled')
  })

  it('cancelled: shows that the run was cancelled', () => {
    expect(render('cancelled')).toContain('Run cancelled.')
  })

  it('error: shows the message, or a default when there is none', () => {
    expect(render('error', { message: 'boom' })).toContain('Run failed: boom')
    expect(render('error')).toContain('Run failed: unknown error')
  })
})