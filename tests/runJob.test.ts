import { describe, it, expect } from 'vitest'
import type { World } from '../src/engine/population'
import type { Weather } from '../src/engine/weather'
import type { PolicyFile } from '../src/engine/policyData'
import { DEFAULT_PARAMS } from '../src/engine/params'
import type { Params } from '../src/engine/params'
import { SNAPSHOT_EVERY } from '../src/engine/run'
import { runJob } from '../src/engine/runJob'
import type { EngineData, RunRequest, WorkerReply, DoneReply, ProgressReply } from '../src/engine/runJob'

const HOUSEHOLDS = 40
const SIZE = 4
const PEOPLE = HOUSEHOLDS * SIZE
const DAYS = 90
const M = 2

// A small stand-in world: two municipalities with 20 households each.
function makeWorld(): World {
  const householdMunicipality = new Int32Array(HOUSEHOLDS)
  const householdSize = new Uint8Array(HOUSEHOLDS).fill(SIZE)
  const householdFirstPerson = new Int32Array(HOUSEHOLDS)
  const householdBarangay = new Int32Array(HOUSEHOLDS)
  for (let h = 0; h < HOUSEHOLDS; h++) {
    householdMunicipality[h] = h < HOUSEHOLDS / 2 ? 0 : 1
    householdFirstPerson[h] = h * SIZE
  }
  const personHousehold = new Int32Array(PEOPLE)
  for (let p = 0; p < PEOPLE; p++) personHousehold[p] = Math.floor(p / SIZE)
  return {
    municipalities: ['A', 'B'],
    barangays: ['a1', 'b1'],
    householdMunicipality,
    householdBarangay,
    householdFirstPerson,
    householdSize,
    personHousehold,
    personState: new Uint8Array(PEOPLE),
  } as unknown as World
}

const weather: Weather = {
  start: '2019-01-01',
  days: DAYS,
  t2m: new Float64Array(DAYS).fill(28),
  rain: new Float64Array(DAYS).fill(7),
  rain14: new Float64Array(DAYS).fill(100),
}

const policyFile: PolicyFile = {
  municipalities: [
    { municipality: 'A', wasteCollectionIntervalDays: 7, foggingTriggerCases: 1 },
    { municipality: 'B', wasteCollectionIntervalDays: 7, foggingTriggerCases: 1 },
  ],
  centroids: {
    A: { lon: 123.0, lat: 14.0 },
    B: { lon: 123.2, lat: 14.1 },
  },
}

const data: EngineData = { world: makeWorld(), weather, policyFile }

// About 3 imported infections per day, so cases appear and fogging can trigger.
const IMPORTS: Partial<Params> = {
  seedInfected: 0,
  importPerDayPer100k: 200,
  importSurgeOn: false,
}

function request(overrides: Partial<RunRequest> = {}, params: Partial<Params> = {}): RunRequest {
  return {
    type: 'run',
    id: 7,
    params: { ...DEFAULT_PARAMS, spinupDays: 20, ...params },
    seed: 1,
    ...overrides,
  }
}

function run(req: RunRequest, d: EngineData = data) {
  const replies: WorkerReply[] = []
  const transfers: ArrayBuffer[][] = []
  runJob(d, req, (reply, transfer) => {
    replies.push(reply)
    if (transfer) transfers.push(transfer)
  })
  return { replies, transfers }
}

function doneOf(replies: WorkerReply[]): DoneReply {
  const found = replies.find((r): r is DoneReply => r.type === 'done')
  if (!found) throw new Error('no done reply')
  return found
}

function sum(a: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]
  return s
}

describe('runJob', () => {
  it('sends progress messages, then exactly one done message, all with the run id', () => {
    const { replies } = run(request())
    expect(replies.every((r) => r.id === 7)).toBe(true)
    expect(replies.filter((r) => r.type === 'done').length).toBe(1)
    expect(replies[replies.length - 1].type).toBe('done')
    const progress = replies.filter((r): r is ProgressReply => r.type === 'progress')
    expect(progress.length).toBeGreaterThan(1)
    expect(progress[progress.length - 1]).toEqual({
      type: 'progress', id: 7, daysDone: DAYS, totalDays: DAYS,
    })
  })

  it('the done message has the time taken and a result with one entry per day', () => {
    const { replies } = run(request())
    const done = doneOf(replies)
    expect(done.seconds).toBeGreaterThanOrEqual(0)
    expect(done.result.days).toBe(DAYS)
    expect(done.result.adults.length).toBe(DAYS)
    expect(done.result.immatures.length).toBe(DAYS)
    expect(done.result.onsets.length).toBe(DAYS * M)
    expect(done.result.householdStates.length).toBe(Math.ceil(DAYS / SNAPSHOT_EVERY) * HOUSEHOLDS)
  })

  it('hands over the 15 memory blocks of the result with the done message', () => {
    const { replies, transfers } = run(request())
    const done = doneOf(replies)
    expect(transfers.length).toBe(1)
    expect(transfers[0].length).toBe(15)
    for (const b of transfers[0]) expect(b).toBeInstanceOf(ArrayBuffer)
    expect(transfers[0]).toContain(done.result.adults.buffer)
    expect(transfers[0]).toContain(done.result.immatures.buffer)
    expect(transfers[0]).toContain(done.result.onsets.buffer)
    expect(transfers[0]).toContain(done.result.biteInfections.buffer)
    expect(transfers[0]).toContain(done.result.householdStates.buffer)
  })

  it('gives the same result for the same request', () => {
    const a = doneOf(run(request({}, IMPORTS)).replies).result
    const b = doneOf(run(request({}, IMPORTS)).replies).result
    expect(Array.from(b.adults)).toEqual(Array.from(a.adults))
    expect(Array.from(b.onsets)).toEqual(Array.from(a.onsets))
  })

  it('cleaning interval 0 means nobody ever cleans; the policy file interval does clean', () => {
    const none = doneOf(run(request({ cleaningIntervalDays: 0 })).replies).result
    expect(sum(none.cleanings)).toBe(0)
    const normal = doneOf(run(request()).replies).result
    expect(sum(normal.cleanings)).toBeGreaterThan(0)
  })

  it('foggingOn false means no fogging, and the request settings are not changed', () => {
    const req = request({ foggingOn: false }, { ...IMPORTS, fogCoverage: 1 })
    const result = doneOf(run(req).replies).result
    expect(sum(result.fogged)).toBe(0)
    expect(sum(result.foggingRounds)).toBe(0)
    expect(req.params.fogCoverage).toBe(1)
  })

  it('with fogging on and cases appearing, fogging happens', () => {
    const result = doneOf(run(request({}, { ...IMPORTS, fogCoverage: 1 })).replies).result
    expect(sum(result.foggingRounds)).toBeGreaterThan(0)
  })

  it('a very high fogging trigger means no fogging even with fogging on', () => {
    const req = request({ foggingTrigger: 1000 }, { ...IMPORTS, fogCoverage: 1 })
    const result = doneOf(run(req).replies).result
    expect(sum(result.foggingRounds)).toBe(0)
  })

  const bad: [string, RunRequest][] = [
    ['compliance above 1', request({}, { compliance: 2 })],
    ['a seed that is not a whole number', request({ seed: 1.5 })],
    ['a negative cleaning interval', request({ cleaningIntervalDays: -1 })],
    ['a fogging trigger that is not a whole number', request({ foggingTrigger: 1.5 })],
  ]
  for (const [name, req] of bad) {
    it(`rejects ${name} with one error message and no run`, () => {
      const { replies } = run(req)
      expect(replies.length).toBe(1)
      expect(replies[0].type).toBe('error')
      expect(replies[0].id).toBe(7)
    })
  }

  it('a municipality missing from the policy file gives an error message, not a crash', () => {
    const partial: EngineData = {
      ...data,
      policyFile: { ...policyFile, municipalities: [policyFile.municipalities[0]] },
    }
    const { replies } = run(request(), partial)
    expect(replies.length).toBe(1)
    expect(replies[0]).toMatchObject({
      type: 'error',
      id: 7,
      message: expect.stringContaining('municipality "B"'),
    })
  })
})