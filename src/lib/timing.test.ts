import { describe, expect, it } from 'vitest'
import { actualRests, restBefore, sessionTimeSplit } from './timing'
import type { LoggedSet, Session, SessionExercise } from '../types'

let n = 0
const doneSet = (completedAt: number | null, id = `s${n++}`): LoggedSet => ({
  id,
  weight: 50,
  reps: 8,
  done: completedAt !== null,
  warmup: false,
  completedAt,
})

const ex = (sets: LoggedSet[]): SessionExercise => ({
  id: `e${n++}`,
  exerciseId: 'x',
  name: 'X',
  repLow: 8,
  repHigh: 12,
  restSec: 120,
  notes: '',
  sets,
})

const minutes = (m: number) => m * 60_000

const sess = (exercises: SessionExercise[], startedAt = 0, finishedAt: number | null = null): Session => ({
  id: 'sess',
  programId: null,
  dayId: null,
  dayName: 'D',
  dayNotes: '',
  startedAt,
  finishedAt,
  exercises,
  notes: '',
})

describe('actualRests', () => {
  it('derives gaps between consecutive completions, first set has none', () => {
    const s = sess([ex([doneSet(minutes(2), 'a'), doneSet(minutes(5), 'b'), doneSet(minutes(9), 'c')])])
    expect(actualRests(s)).toEqual([
      { setId: 'b', gapMs: minutes(3) },
      { setId: 'c', gapMs: minutes(4) },
    ])
  })

  it('counts cross-exercise gaps', () => {
    const s = sess([
      ex([doneSet(minutes(2), 'a')]),
      ex([doneSet(minutes(6), 'b')]),
    ])
    expect(actualRests(s)).toEqual([{ setId: 'b', gapMs: minutes(4) }])
  })

  it('skips un-timestamped sets and sorts out-of-order timestamps', () => {
    const s = sess([
      ex([doneSet(null, 'skip'), doneSet(minutes(10), 'late'), doneSet(minutes(4), 'early')]),
    ])
    expect(actualRests(s)).toEqual([{ setId: 'late', gapMs: minutes(6) }])
  })

  it('restBefore finds the one gap or null', () => {
    const s = sess([ex([doneSet(minutes(1), 'a'), doneSet(minutes(3), 'b')])])
    expect(restBefore(s, 'b')).toBe(minutes(2))
    expect(restBefore(s, 'a')).toBeNull()
    expect(restBefore(s, 'ghost')).toBeNull()
  })
})

describe('sessionTimeSplit', () => {
  it('splits total into rest and work, summing exactly', () => {
    const s = sess(
      [ex([doneSet(minutes(5), 'a'), doneSet(minutes(8), 'b'), doneSet(minutes(12), 'c')])],
      0,
      minutes(14),
    )
    const split = sessionTimeSplit(s)
    expect(split.totalMs).toBe(minutes(14))
    expect(split.restMs).toBe(minutes(7)) // 3 + 4
    expect(split.workMs).toBe(minutes(7))
    expect(split.workMs + split.restMs).toBe(split.totalMs)
    expect(split.avgRestMs).toBe(minutes(3.5))
    expect(split.setCount).toBe(3)
  })

  it('handles a session with no completions', () => {
    const s = sess([ex([doneSet(null)])], 0, minutes(10))
    const split = sessionTimeSplit(s)
    expect(split).toMatchObject({ totalMs: minutes(10), restMs: 0, avgRestMs: null, setCount: 0 })
  })

  it('caps rest at the total for degenerate timestamps', () => {
    // Completions stamped outside the session window can't produce rest > total.
    const s = sess([ex([doneSet(minutes(0), 'a'), doneSet(minutes(60), 'b')])], 0, minutes(10))
    const split = sessionTimeSplit(s)
    expect(split.restMs).toBeLessThanOrEqual(split.totalMs)
    expect(split.workMs).toBeGreaterThanOrEqual(0)
  })
})
