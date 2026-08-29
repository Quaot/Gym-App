import { describe, expect, it } from 'vitest'
import { reducer } from './reducer'
import type { Action } from './reducer'
import { freshState } from './migrate'
import type { AppState, LoggedSet, Session } from '../types'

const set = (over: Partial<LoggedSet> = {}): LoggedSet => ({
  id: over.id ?? 'set-1',
  weight: null,
  reps: null,
  done: false,
  warmup: false,
  completedAt: null,
  ...over,
})

const session = (over: Partial<Session> = {}): Session => ({
  id: 'sess-1',
  programId: null,
  dayId: null,
  dayName: 'Push 1',
  dayNotes: '',
  startedAt: 1_000_000,
  finishedAt: null,
  notes: '',
  exercises: [
    {
      id: 'ex-1',
      exerciseId: 'barbell-bench-press',
      name: 'Barbell Bench Press',
      repLow: 5,
      repHigh: 8,
      repCap: 13,
      restSec: 180,
      warmupPlan: [],
      notes: '',
      sets: [set({ id: 'set-1' }), set({ id: 'set-2' })],
    },
  ],
  ...over,
})

const withLive = (): AppState => {
  const base = freshState()
  const live = session()
  return { ...base, sessions: [live, ...base.sessions], activeSessionId: live.id }
}

describe('session invariants', () => {
  it('refuses to start a session while one is active (bug 1)', () => {
    const state = withLive()
    const next = reducer(state, { type: 'startSession', session: session({ id: 'sess-2' }) })
    expect(next).toBe(state)
    expect(next.sessions.filter((s) => s.finishedAt === null)).toHaveLength(1)
  })

  it('starts normally when nothing is active', () => {
    const state = freshState()
    const next = reducer(state, { type: 'startSession', session: session() })
    expect(next.activeSessionId).toBe('sess-1')
    expect(next.sessions[0].id).toBe('sess-1')
  })

  it('refuses completeSet without concrete positive reps (bug 2)', () => {
    const state = withLive()
    for (const reps of [0, -1, NaN, Infinity]) {
      const next = reducer(state, {
        type: 'completeSet', exId: 'ex-1', setId: 'set-1', weight: 60, reps, now: 5,
      })
      expect(next).toBe(state)
    }
  })

  it('completeSet stamps values, done and completedAt', () => {
    const next = reducer(withLive(), {
      type: 'completeSet', exId: 'ex-1', setId: 'set-1', weight: 60, reps: 5, now: 1_000_500,
    })
    const s = next.sessions[0].exercises[0].sets[0]
    expect(s).toMatchObject({ weight: 60, reps: 5, done: true, completedAt: 1_000_500 })
  })

  it('uncompleteSet clears done and completedAt but keeps the values', () => {
    let state = reducer(withLive(), {
      type: 'completeSet', exId: 'ex-1', setId: 'set-1', weight: 60, reps: 5, now: 7,
    })
    state = reducer(state, { type: 'uncompleteSet', exId: 'ex-1', setId: 'set-1' })
    const s = state.sessions[0].exercises[0].sets[0]
    expect(s).toMatchObject({ weight: 60, reps: 5, done: false, completedAt: null })
  })

  it('finishSession drops undone sets, never a done one, and drops empty exercises', () => {
    let state = withLive()
    state = reducer(state, {
      type: 'completeSet', exId: 'ex-1', setId: 'set-1', weight: 60, reps: 5, now: 9,
    })
    state = reducer(state, { type: 'finishSession', now: 2_000_000 })
    const finished = state.sessions.find((s) => s.id === 'sess-1')!
    expect(finished.finishedAt).toBe(2_000_000)
    expect(finished.exercises[0].sets).toHaveLength(1)
    expect(finished.exercises[0].sets[0].done).toBe(true)
    expect(state.activeSessionId).toBeNull()
  })

  it('finishSession with nothing done leaves an empty exercise list, and clears rest', () => {
    let state = withLive()
    state = { ...state, rest: { endsAt: 99, totalSec: 60, exerciseName: 'x' } }
    state = reducer(state, { type: 'finishSession', now: 5 })
    expect(state.sessions.find((s) => s.id === 'sess-1')!.exercises).toHaveLength(0)
    expect(state.rest).toBeNull()
  })

  it('resumeSession only resumes an existing unfinished session while idle', () => {
    const base = freshState()
    const orphan = session({ id: 'orphan' })
    const done = session({ id: 'done', finishedAt: 42 })
    const state = { ...base, sessions: [orphan, done] }
    expect(reducer(state, { type: 'resumeSession', sessionId: 'orphan' }).activeSessionId).toBe('orphan')
    expect(reducer(state, { type: 'resumeSession', sessionId: 'done' })).toBe(state)
    expect(reducer(state, { type: 'resumeSession', sessionId: 'ghost' })).toBe(state)
    const busy = { ...state, activeSessionId: 'orphan' }
    expect(reducer(busy, { type: 'resumeSession', sessionId: 'orphan' })).toBe(busy)
  })

  it('discardActiveSession removes the session and clears rest', () => {
    let state = withLive()
    state = { ...state, rest: { endsAt: 99, totalSec: 60, exerciseName: 'x' } }
    state = reducer(state, { type: 'discardActiveSession' })
    expect(state.sessions.find((s) => s.id === 'sess-1')).toBeUndefined()
    expect(state.activeSessionId).toBeNull()
    expect(state.rest).toBeNull()
  })

  it('deleteSession of the active session clears activeSessionId', () => {
    const state = reducer(withLive(), { type: 'deleteSession', sessionId: 'sess-1' })
    expect(state.activeSessionId).toBeNull()
  })
})

describe('purity and no-ops', () => {
  it('is deterministic: identical (state, action) gives identical results', () => {
    const state = withLive()
    const action: Action = {
      type: 'completeSet', exId: 'ex-1', setId: 'set-1', weight: 62.5, reps: 5, now: 123,
    }
    expect(reducer(state, action)).toEqual(reducer(state, action))
  })

  it('returns the same reference for actions that change nothing', () => {
    const state = withLive()
    const noops: Action[] = [
      { type: 'startSession', session: session({ id: 'other' }) },
      { type: 'resumeSession', sessionId: 'ghost' },
      { type: 'setActiveProgram', programId: 'ghost' },
      { type: 'stopRest' },
      { type: 'extendRest', bySec: 30 },
      { type: 'completeSet', exId: 'ex-1', setId: 'set-1', weight: 1, reps: 0, now: 1 },
    ]
    for (const action of noops) expect(reducer(state, action)).toBe(state)
  })

  it('actions on missing ids are safe no-ops that alter nothing', () => {
    const state = withLive()
    const snapshot = JSON.parse(JSON.stringify(state))
    const actions: Action[] = [
      { type: 'updateSet', exId: 'ghost', setId: 'x', patch: { weight: 1 } },
      { type: 'deleteSet', exId: 'ex-1', setId: 'ghost' },
      { type: 'removeSessionExercise', exId: 'ghost' },
      { type: 'moveSessionExercise', exId: 'ghost', delta: 1 },
      { type: 'updateDay', programId: 'ghost', dayId: 'x', patch: { name: 'y' } },
    ]
    for (const action of actions) reducer(state, action)
    expect(JSON.parse(JSON.stringify(state))).toEqual(snapshot)
  })
})

describe('programs', () => {
  it('renameProgram touches only the name and trims it', () => {
    const state = freshState()
    const id = state.programs[0].id
    const next = reducer(state, { type: 'renameProgram', programId: id, name: '  My Split  ' })
    expect(next.programs[0].name).toBe('My Split')
    expect(next.programs[0].days).toBe(state.programs[0].days)
    const blank = reducer(state, { type: 'renameProgram', programId: id, name: '   ' })
    expect(blank.programs[0].name).toBe(state.programs[0].name)
  })

  it('never deletes the last program', () => {
    const state = freshState()
    expect(reducer(state, { type: 'deleteProgram', programId: state.programs[0].id })).toBe(state)
  })

  it('deleting the active program moves activation to a survivor', () => {
    let state = freshState()
    const second = { ...state.programs[0], id: 'p2', name: 'Second' }
    state = reducer(state, { type: 'addProgram', program: second, activate: true })
    expect(state.activeProgramId).toBe('p2')
    state = reducer(state, { type: 'deleteProgram', programId: 'p2' })
    expect(state.activeProgramId).toBe(state.programs[0].id)
  })
})

describe('rest timer slice', () => {
  it('start, extend, stop', () => {
    let state = freshState()
    state = reducer(state, {
      type: 'startRest', rest: { endsAt: 10_000, totalSec: 90, exerciseName: 'Row' },
    })
    expect(state.rest).toMatchObject({ endsAt: 10_000, totalSec: 90 })
    state = reducer(state, { type: 'extendRest', bySec: 30 })
    expect(state.rest).toMatchObject({ endsAt: 40_000, totalSec: 120 })
    state = reducer(state, { type: 'stopRest' })
    expect(state.rest).toBeNull()
  })
})

describe('sleep slice', () => {
  it('upserts keyed by (night, source) and keeps entries sorted', () => {
    let state = freshState()
    const entry = (night: string, source: 'manual' | 'health', asleepMin: number) => ({
      id: `${night}-${source}`, night, asleepMin, inBedMin: null, source,
    })
    state = reducer(state, {
      type: 'upsertSleep',
      entries: [entry('2026-08-02', 'manual', 420), entry('2026-08-01', 'health', 460)],
    })
    expect(state.sleep.map((e) => e.night)).toEqual(['2026-08-01', '2026-08-02'])
    // Same night+source replaces; different source coexists.
    state = reducer(state, {
      type: 'upsertSleep',
      entries: [entry('2026-08-02', 'manual', 400), entry('2026-08-02', 'health', 415)],
    })
    expect(state.sleep).toHaveLength(3)
    expect(state.sleep.find((e) => e.night === '2026-08-02' && e.source === 'manual')!.asleepMin).toBe(400)
  })
})

describe('a logged set is history', () => {
  it('refuses to patch a set that is already done', () => {
    // A gesture that settles late, or any stray dispatch, must never rewrite
    // what was recorded. Uncomplete it first and the edit lands.
    let state = withLive()
    const exId = state.sessions[0].exercises[0].id
    const setId = state.sessions[0].exercises[0].sets[0].id
    state = reducer(state, { type: 'completeSet', exId, setId, weight: 100, reps: 5, now: 1000 })
    state = reducer(state, { type: 'updateSet', exId, setId, patch: { weight: 999 } })
    const logged = state.sessions[0].exercises[0].sets[0]
    expect(logged.weight).toBe(100)
    expect(logged.reps).toBe(5)

    state = reducer(state, { type: 'uncompleteSet', exId, setId })
    state = reducer(state, { type: 'updateSet', exId, setId, patch: { weight: 999 } })
    expect(state.sessions[0].exercises[0].sets[0].weight).toBe(999)
  })
})
