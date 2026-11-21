import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildPolicyArrays } from '../src/engine/policyData'
import type { PolicyFile } from '../src/engine/policyData'
import { buildWorld } from '../src/engine/population'
import type { PopulationFile, World } from '../src/engine/population'

function fakeWorld(): World {
  // 3 households: two in Daet (index 0), one in Basud (index 1)
  return {
    municipalities: ['Daet', 'Basud'],
    householdMunicipality: new Uint8Array([0, 0, 1]),
  } as unknown as World
}

function fakePolicy(): PolicyFile {
  // listed in a different order from the world
  return {
    municipalities: [
      { municipality: 'Basud', wasteCollectionIntervalDays: 14, foggingTriggerCases: 5 },
      { municipality: 'Daet', wasteCollectionIntervalDays: 3, foggingTriggerCases: 2 },
    ],
    centroids: {},
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf-8')) as T
}

describe('buildPolicyArrays', () => {
  it('gives each household the interval of its own municipality', () => {
    const { intervals } = buildPolicyArrays(fakeWorld(), fakePolicy())
    expect(Array.from(intervals)).toEqual([3, 3, 14])
  })

  it('gives one fogging trigger per municipality, in the world order', () => {
    const { foggingTrigger } = buildPolicyArrays(fakeWorld(), fakePolicy())
    expect(Array.from(foggingTrigger)).toEqual([2, 5])
  })

  it('throws when a municipality is missing from the policy file', () => {
    const policy = fakePolicy()
    policy.municipalities.pop()
    expect(() => buildPolicyArrays(fakeWorld(), policy)).toThrow()
  })

  it('works on the real files: 3,797 households, 12 triggers, all every 7 days', () => {
    const world = buildWorld(readJson<PopulationFile>('public/data/population.json'))
    const { intervals, foggingTrigger } = buildPolicyArrays(
      world,
      readJson<PolicyFile>('public/data/policy.json'),
    )
    expect(intervals.length).toBe(3797)
    expect(foggingTrigger.length).toBe(12)
    expect(intervals.every((v) => v === 7)).toBe(true)
    expect(foggingTrigger.every((v) => v === 1)).toBe(true)
  })
})