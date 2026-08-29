import { describe, expect, it } from 'vitest'
import { prefillFor } from './prefill'
import { freshState } from '../store/migrate'
import type { AppState, LoggedSet, Session, SessionExercise } from '../types'

const EX = 'barbell-bench-press'

let n = 0
const set = (over: Partial<LoggedSet>): LoggedSet => ({
  id: `s${n++}`,
  weight: null,
  reps: null,
  done: false,
  warmup: false,
  completedAt: null,
  ...over,
})

const exercise = (sets: LoggedSet[], over: Partial<SessionExercise> = {}): SessionExercise => ({
  id: `e${n++}`,
  exerciseId: EX,
  name: 'Barbell Bench Press',
  repLow: 5,
  repHigh: 8,
  restSec: 180,
  notes: '',
  sets,
  ...over,
})

const session = (exercises: SessionExercise[], over: Partial<Session> = {}): Session => ({
  id: `sess${n++}`,
  programId: null,
  dayId: null,
  dayName: 'Push 1',
  dayNotes: '',
  startedAt: 1_000,
  finishedAt: null,
  notes: '',
  exercises,
  ...over,
})

const stateWith = (sessions: Session[]): AppState => ({ ...freshState(), sessions })

/** Last session: 2 warm-ups (40×10, 50×6) then working sets 100×5, 102.5×5, 105×4. */
const lastSession = () =>
  session(
    [
      exercise([
        set({ weight: 40, reps: 10, done: true, warmup: true }),
        set({ weight: 50, reps: 6, done: true, warmup: true }),
        set({ weight: 100, reps: 5, done: true }),
        set({ weight: 102.5, reps: 5, done: true }),
        set({ weight: 105, reps: 4, done: true }),
      ]),
    ],
    { finishedAt: 2_000 },
  )

describe('working-set prefill', () => {
  it('maps working ordinal to working ordinal even with warm-up rows in front (bug 8)', () => {
    // Today: 2 warm-up rows then 3 empty working rows. Row index 2 is working
    // ordinal 0 and must get last session's FIRST working set (100), not its
    // third (105) as raw-index logic would give.
    const today = session([
      exercise([
        set({ warmup: true }),
        set({ warmup: true }),
        set({}),
        set({}),
        set({}),
      ]),
    ])
    const state = stateWith([today, lastSession()])
    expect(prefillFor(state, today, today.exercises[0], 2)).toEqual({ weight: 100, reps: 5 })
    expect(prefillFor(state, today, today.exercises[0], 3)).toEqual({ weight: 102.5, reps: 5 })
    expect(prefillFor(state, today, today.exercises[0], 4)).toEqual({ weight: 105, reps: 4 })
  })

  it('never inherits a warm-up weight into a working set (bug 9)', () => {
    // Today: one completed warm-up at 40, then an empty working row, and no
    // history. The working row must NOT pick up the 40.
    const today = session([
      exercise([set({ weight: 40, reps: 10, done: true, warmup: true }), set({})]),
    ])
    const state = stateWith([today])
    const fill = prefillFor(state, today, today.exercises[0], 1)
    expect(fill.weight).not.toBe(40)
    expect(fill).toEqual({ weight: null, reps: 5 }) // repLow fallback
  })

  it("carries today's previous working set before looking at history", () => {
    const today = session([
      exercise([set({ weight: 110, reps: 3, done: true }), set({})]),
    ])
    const state = stateWith([today, lastSession()])
    expect(prefillFor(state, today, today.exercises[0], 1)).toEqual({ weight: 110, reps: 3 })
  })

  it('overflow working rows fall back to the last working set of last session', () => {
    const today = session([exercise([set({}), set({}), set({}), set({}), set({})])])
    const state = stateWith([today, lastSession()])
    expect(prefillFor(state, today, today.exercises[0], 4)).toEqual({ weight: 105, reps: 4 })
  })

  it('first-ever exercise ghosts the bottom of the programmed rep range', () => {
    const today = session([exercise([set({})])])
    const state = stateWith([today])
    expect(prefillFor(state, today, today.exercises[0], 0)).toEqual({ weight: null, reps: 5 })
  })
})

describe('warm-up prefill', () => {
  it('warm-up rows inherit only from warm-ups, by warm-up ordinal', () => {
    const today = session([exercise([set({ warmup: true }), set({ warmup: true })])])
    const state = stateWith([today, lastSession()])
    expect(prefillFor(state, today, today.exercises[0], 0)).toEqual({ weight: 40, reps: 10 })
    expect(prefillFor(state, today, today.exercises[0], 1)).toEqual({ weight: 50, reps: 6 })
  })

  it("with no warm-up history, ghosts half of today's first working weight on the step grid", () => {
    const today = session([
      exercise([set({ warmup: true }), set({ weight: 100, reps: 5 })]),
    ])
    const state = stateWith([today]) // weightStep 2.5
    expect(prefillFor(state, today, today.exercises[0], 0)).toEqual({ weight: 50, reps: 10 })

    // Off-grid halves land on the nearest step: 102.5 / 2 = 51.25 -> 52.5.
    const odd = session([
      exercise([set({ warmup: true }), set({ weight: 102.5, reps: 5 })]),
    ])
    expect(prefillFor(stateWith([odd]), odd, odd.exercises[0], 0)).toEqual({ weight: 52.5, reps: 10 })
  })

  it('with no working weight anywhere, warm-up ghost has null weight', () => {
    const today = session([exercise([set({ warmup: true })])])
    const state = stateWith([today])
    expect(prefillFor(state, today, today.exercises[0], 0)).toEqual({ weight: null, reps: 10 })
  })
})

describe('contract with completeSet (bug 10)', () => {
  it('the ghost is exactly what completion would commit', () => {
    // prefillFor is the single source both for display and for the completeSet
    // resolution — this test pins the shared shape.
    const today = session([exercise([set({})])])
    const state = stateWith([today, lastSession()])
    const ghost = prefillFor(state, today, today.exercises[0], 0)
    expect(ghost).toEqual({ weight: 100, reps: 5 })
  })
})
