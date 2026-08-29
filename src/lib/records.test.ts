// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { AppState, Exercise, LoggedSet, Session } from '../types'
import { recordsIn } from './history'

const set = (weight: number | null, reps: number, over: Partial<LoggedSet> = {}): LoggedSet => ({
  id: `s${Math.random()}`, weight, reps, done: true, warmup: false, completedAt: 1, ...over,
})

const session = (id: string, sets: LoggedSet[], finishedAt: number | null): Session => ({
  id,
  programId: 'p',
  dayId: 'd',
  dayName: 'Push 1',
  dayNotes: '',
  startedAt: 0,
  finishedAt,
  notes: '',
  exercises: [{
    id: `ex-${id}`,
    exerciseId: 'bench',
    name: 'Bench',
    repLow: 3,
    repHigh: 5,
    repCap: 7,
    restSec: 180,
    warmupPlan: [],
    notes: '',
    sets,
  }],
})

const bench: Exercise = {
  id: 'bench', name: 'Bench', bodyweight: false, equipment: 'barbell', increment: 5, archived: false,
}
const pullUp: Exercise = { ...bench, id: 'bench', name: 'Pull-Up', bodyweight: true }

const state = (sessions: Session[], catalog: Record<string, Exercise> = { bench }) =>
  ({ sessions, catalog }) as Pick<AppState, 'sessions' | 'catalog'>

describe('recordsIn', () => {
  it('calls a heavier estimated max a record', () => {
    const past = session('past', [set(185, 5)], 100)
    const today = session('today', [set(205, 5)], null)
    const out = recordsIn(state([past, today]), today)
    expect(out.get('ex-today')?.set.weight).toBe(205)
  })

  it('counts more reps at the same weight', () => {
    const past = session('past', [set(185, 5)], 100)
    const today = session('today', [set(185, 8)], null)
    expect(recordsIn(state([past, today]), today).size).toBe(1)
  })

  it('says nothing for a lighter day', () => {
    const past = session('past', [set(225, 5)], 100)
    const today = session('today', [set(185, 5)], null)
    expect(recordsIn(state([past, today]), today).size).toBe(0)
  })

  it('treats a first ever session as a baseline, not a record', () => {
    const today = session('today', [set(185, 5)], null)
    expect(recordsIn(state([today]), today).size).toBe(0)
  })

  it('ignores warm-ups and unfinished rows', () => {
    const past = session('past', [set(185, 5)], 100)
    const today = session('today', [
      set(315, 3, { warmup: true }),
      set(405, 1, { done: false }),
      set(185, 5),
    ], null)
    expect(recordsIn(state([past, today]), today).size).toBe(0)
  })

  it('ranks a bodyweight movement by reps', () => {
    const past = session('past', [set(null, 10)], 100)
    const today = session('today', [set(null, 12)], null)
    expect(recordsIn(state([past, today], { bench: pullUp }), today).size).toBe(1)
  })

  it('does not compare a session against itself', () => {
    const today = session('today', [set(185, 5), set(205, 5)], null)
    const past = session('past', [set(135, 5)], 100)
    const out = recordsIn(state([past, today]), today)
    expect(out.get('ex-today')?.set.weight).toBe(205)
  })
})
