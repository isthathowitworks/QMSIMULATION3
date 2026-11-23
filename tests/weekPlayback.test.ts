import { describe, expect, it } from 'vitest'
import { clampWeek, pressPlayPause, tick } from '../src/ui/map/weekPlayback'

describe('clampWeek', () => {
  it('keeps a week that is inside the run', () => {
    expect(clampWeek(3, 10)).toBe(3)
    expect(clampWeek(0, 10)).toBe(0)
    expect(clampWeek(9, 10)).toBe(9)
  })

  it('moves a week below 0 to 0 and a week past the end to the last week', () => {
    expect(clampWeek(-2, 10)).toBe(0)
    expect(clampWeek(99, 10)).toBe(9)
  })

  it('rounds a fraction to a whole week', () => {
    expect(clampWeek(2.6, 10)).toBe(3)
  })

  it('gives 0 for a week that is not a number, or when there are no weeks', () => {
    expect(clampWeek(Number.NaN, 10)).toBe(0)
    expect(clampWeek(5, 0)).toBe(0)
    expect(clampWeek(5, Number.NaN)).toBe(0)
  })
})

describe('tick', () => {
  it('moves one week on and keeps playing', () => {
    expect(tick(3, 10)).toEqual({ week: 4, playing: true })
  })

  it('stops when it reaches the last week', () => {
    expect(tick(8, 10)).toEqual({ week: 9, playing: false })
  })

  it('stays on the last week and stops, even from a week past the end', () => {
    expect(tick(9, 10)).toEqual({ week: 9, playing: false })
    expect(tick(50, 10)).toEqual({ week: 9, playing: false })
  })

  it('has nothing to play when there are no weeks', () => {
    expect(tick(0, 0)).toEqual({ week: 0, playing: false })
  })
})

describe('pressPlayPause', () => {
  it('pauses while playing, on the same week', () => {
    expect(pressPlayPause(4, 10, true)).toEqual({ week: 4, playing: false })
  })

  it('plays from the current week when paused', () => {
    expect(pressPlayPause(4, 10, false)).toEqual({ week: 4, playing: true })
  })

  it('starts again from week 0 when play is pressed on the last week', () => {
    expect(pressPlayPause(9, 10, false)).toEqual({ week: 0, playing: true })
  })

  it('cannot play with one week or none', () => {
    expect(pressPlayPause(0, 1, false)).toEqual({ week: 0, playing: false })
    expect(pressPlayPause(0, 0, false)).toEqual({ week: 0, playing: false })
  })
})