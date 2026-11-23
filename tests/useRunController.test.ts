import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useRunController } from '../src/state/useRunController'

function Probe() {
  const { state } = useRunController('/')
  return createElement('p', null, `${state.status}|${state.daysDone}|${state.result === null}`)
}

describe('useRunController', () => {
  it('starts idle, with no result, and does not start a worker on load', () => {
    // a real Worker would throw here, because there is none in the test environment
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<p>idle|0|true</p>')
  })
})