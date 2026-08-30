import { describe, expect, it } from 'vitest'
import { workingRows, workingSets } from './history'
import type { LoggedSet, SessionExercise } from '../types'

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

const exercise = (sets: LoggedSet[]): SessionExercise => ({
  id: 'e1',
  exerciseId: 'romanian-deadlift',
  name: 'Romanian Deadlift',
  repLow: 8,
  repHigh: 10,
  repCap: 15,
  restSec: 180,
  warmupPlan: [],
  notes: '',
  sets,
})

describe('working rows against working sets', () => {
  // A ramped lift shows four warm-up rows in front of four working rows, and
  // the "N × 8-10" pill used to count all eight of them.
  const ramped = exercise([
    set({ warmup: true, done: true, weight: 90, reps: 6 }),
    set({ warmup: true, done: true, weight: 125, reps: 4 }),
    set({ warmup: true }),
    set({ warmup: true }),
    set({ done: true, weight: 180, reps: 10 }),
    set({}),
    set({}),
    set({}),
  ])

  it('counts every working row the rep range describes, logged or not', () => {
    expect(workingRows(ramped)).toHaveLength(4)
  })

  it('never counts a warm-up, however it was logged', () => {
    expect(workingRows(ramped).every((s) => !s.warmup)).toBe(true)
  })

  it('leaves workingSets meaning what it meant: the ones you actually did', () => {
    expect(workingSets(ramped)).toHaveLength(1)
  })

  it('agrees with workingSets once the exercise is finished', () => {
    const finished = exercise([
      set({ warmup: true, done: true, weight: 90, reps: 6 }),
      set({ done: true, weight: 180, reps: 10 }),
      set({ done: true, weight: 180, reps: 9 }),
    ])
    expect(workingRows(finished)).toHaveLength(workingSets(finished).length)
  })
})
