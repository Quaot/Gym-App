import { describe, expect, it } from 'vitest'
import { calendarDays, dayKey, exerciseTrend, memoized, weekKey, weeklyBuckets } from './analytics'
import { recordsIn } from './history'
import { freshState } from '../store/migrate'
import type { AppState, LoggedSet, Session } from '../types'

let n = 0
const done = (weight: number | null, reps: number): LoggedSet => ({
  id: `s${n++}`, weight, reps, done: true, warmup: false, completedAt: null,
})

const sessionAt = (
  finishedAt: number,
  exerciseId: string,
  sets: LoggedSet[],
  name = 'X',
): Session => ({
  id: `sess${n++}`,
  programId: null, dayId: null, dayName: 'D', dayNotes: '',
  startedAt: finishedAt - 3_600_000,
  finishedAt,
  exercises: [{ id: `e${n++}`, exerciseId, name, repLow: 5, repHigh: 8, repCap: 13, restSec: 120, warmupPlan: [], notes: '', sets }],
  notes: '',
})

const at = (iso: string) => new Date(iso).getTime()

const withSessions = (sessions: Session[]): AppState => ({ ...freshState(), sessions })

describe('exerciseTrend', () => {
  it('computes Epley e1RM per session, hand-checked', () => {
    // 100×5 -> 100*(1+5/30) = 116.666… -> 116.7
    // 105×3 -> 105*(1+3/30) = 115.5
    // 102.5×8 -> 102.5*(1+8/30) = 129.833… -> 129.8
    const state = withSessions([
      sessionAt(at('2026-06-01T10:00Z'), 'bench', [done(100, 5)]),
      sessionAt(at('2026-06-08T10:00Z'), 'bench', [done(105, 3)]),
      sessionAt(at('2026-06-15T10:00Z'), 'bench', [done(102.5, 8)]),
    ])
    const trend = exerciseTrend(state, 'bench')
    expect(trend.map((p) => p.score)).toEqual([116.7, 115.5, 129.8])
    // The first session is a baseline, not a record, exactly as recordsIn
    // treats it during a workout. This expectation changed deliberately: the
    // chart used to flag it and count one PR too many for every movement.
    expect(trend.map((p) => p.isPR)).toEqual([false, false, true])
  })

  it('agrees with the workout screen about what a record is', () => {
    // Two places decide this: recordsIn during a workout and exerciseTrend on
    // the chart. They disagreed, so a first session was a PR in one and a
    // baseline in the other. This pins them together.
    const one = withSessions([sessionAt(at('2026-06-01T10:00Z'), 'bench', [done(100, 5)])])
    expect(exerciseTrend(one, 'bench').map((p) => p.isPR)).toEqual([false])
    expect(recordsIn(one, one.sessions[0]).size).toBe(0)

    const two = withSessions([
      sessionAt(at('2026-06-01T10:00Z'), 'bench', [done(100, 5)]),
      sessionAt(at('2026-06-08T10:00Z'), 'bench', [done(110, 5)]),
    ])
    expect(exerciseTrend(two, 'bench').map((p) => p.isPR)).toEqual([false, true])
    expect(recordsIn(two, two.sessions[1]).size).toBe(1)
  })

  it('ranks the best set within a session, not the last one', () => {
    const state = withSessions([
      sessionAt(at('2026-06-01T10:00Z'), 'bench', [done(100, 5), done(80, 12), done(100, 3)]),
    ])
    // 100×5 = 116.7 beats 80×12 = 112 and 100×3 = 110.
    expect(exerciseTrend(state, 'bench')[0]).toMatchObject({ score: 116.7, weight: 100, reps: 5 })
  })

  it('uses reps, not e1RM=0, for bodyweight movements (bug 18)', () => {
    const state = withSessions([
      sessionAt(at('2026-06-01T10:00Z'), 'pull-up', [done(null, 8)]),
      sessionAt(at('2026-06-08T10:00Z'), 'pull-up', [done(null, 10)]),
    ])
    // 'pull-up' is flagged bodyweight in the preset catalog.
    expect(state.catalog['pull-up'].bodyweight).toBe(true)
    const trend = exerciseTrend(state, 'pull-up')
    expect(trend.map((p) => p.score)).toEqual([8, 10])
    expect(trend.map((p) => p.isPR)).toEqual([false, true])
  })

  it('is oldest-first and skips sessions without the exercise', () => {
    const state = withSessions([
      sessionAt(at('2026-06-08T10:00Z'), 'bench', [done(105, 5)]),
      sessionAt(at('2026-06-01T10:00Z'), 'bench', [done(100, 5)]),
      sessionAt(at('2026-06-04T10:00Z'), 'squat', [done(140, 5)]),
    ])
    expect(exerciseTrend(state, 'bench').map((p) => p.weight)).toEqual([100, 105])
  })
})

describe('week bucketing', () => {
  it('weekKey is Monday-based and stable across a month boundary', () => {
    // 2026-08-31 is a Monday; 2026-09-02 (Wed) is the same ISO week.
    expect(weekKey(at('2026-08-31T12:00'))).toBe(weekKey(at('2026-09-02T12:00')))
    // Sunday 2026-08-30 belongs to the PREVIOUS week.
    expect(weekKey(at('2026-08-30T12:00'))).not.toBe(weekKey(at('2026-08-31T12:00')))
  })

  it('zero-fills trailing weeks and sums volume into the right ones', () => {
    const now = at('2026-08-29T12:00') // Saturday; week starts Mon 2026-08-24
    const sessions = [
      sessionAt(at('2026-08-25T10:00'), 'bench', [done(100, 10)]), // this week: 1000
      sessionAt(at('2026-08-18T10:00'), 'bench', [done(90, 10)]),  // last week: 900
      sessionAt(at('2026-08-19T10:00'), 'bench', [done(10, 10)]),  // last week: +100
    ]
    const buckets = weeklyBuckets(sessions, 4, now)
    expect(buckets).toHaveLength(4)
    expect(buckets[3].weekStart).toBe(dayKey(at('2026-08-24T00:00')))
    expect(buckets[3]).toMatchObject({ volume: 1000, sessions: 1 })
    expect(buckets[2]).toMatchObject({ volume: 1000, sessions: 2 })
    expect(buckets[0]).toMatchObject({ volume: 0, sessions: 0 })
  })
})

describe('calendarDays', () => {
  it('marks the right days across a DST month with correct length', () => {
    // October 2026 has 31 days and contains the EU DST fall-back (Oct 25).
    const sessions = [
      sessionAt(at('2026-10-25T10:00'), 'bench', [done(100, 5), done(100, 5)]),
      sessionAt(at('2026-10-01T10:00'), 'bench', [done(100, 5)]),
    ]
    const days = calendarDays(sessions, at('2026-10-15T00:00'))
    expect(days).toHaveLength(31)
    expect(days[0]).toMatchObject({ day: 1, sets: 1 })
    expect(days[24]).toMatchObject({ day: 25, sets: 2 })
    expect(days[30]).toMatchObject({ day: 31, sets: 0 })
    expect(days.filter((d) => d.sets > 0)).toHaveLength(2)
  })
})

describe('memoized', () => {
  it('returns the same reference for the same sessions array', () => {
    const sessions = [sessionAt(at('2026-06-01T10:00Z'), 'bench', [done(100, 5)])]
    const a = memoized(sessions, 'k', () => ({ value: 1 }))
    const b = memoized(sessions, 'k', () => ({ value: 2 }))
    expect(b).toBe(a)
    // A new array identity recomputes.
    const c = memoized([...sessions], 'k', () => ({ value: 3 }))
    expect(c).not.toBe(a)
  })
})
