import { describe, expect, it } from 'vitest'
import type { LoggedSet } from '../types'
import { reconcileWarmups, warmupRows } from './warmups'

const HEAVY = [
  { pct: 0.5, reps: 6 },
  { pct: 0.7, reps: 4 },
  { pct: 0.85, reps: 2 },
  { pct: 0.9, reps: 1 },
]

describe('warmupRows', () => {
  it('builds a ramp on the increment grid, hand-checked', () => {
    // 225 lb, 5 lb grid: 112.5 -> 110, 157.5 -> 155, 191.25 -> 190, 202.5 -> 200.
    expect(warmupRows(HEAVY, 225, 5)).toEqual([
      { weight: 110, reps: 6 },
      { weight: 155, reps: 4 },
      { weight: 190, reps: 2 },
      { weight: 200, reps: 1 },
    ])
  })

  it('rounds down so a warm-up never outweighs its prescription', () => {
    for (const row of warmupRows(HEAVY, 185, 5)) {
      expect(row.weight % 5).toBe(0)
      expect(row.weight).toBeLessThan(185)
    }
  })

  it('drops a step that repeats the weight below it', () => {
    // On a light bar the last two steps collapse onto one loadable weight.
    const rows = warmupRows([{ pct: 0.85, reps: 2 }, { pct: 0.9, reps: 1 }], 55, 10)
    expect(rows).toEqual([{ weight: 40, reps: 2 }])
  })

  it('never suggests a warm-up at or above the working weight', () => {
    const rows = warmupRows([{ pct: 0.95, reps: 2 }, { pct: 1, reps: 1 }], 100, 5)
    for (const row of rows) expect(row.weight).toBeLessThan(100)
  })

  it('returns nothing without a plan or without a planned weight', () => {
    expect(warmupRows([], 225, 5)).toEqual([])
    expect(warmupRows(HEAVY, null, 5)).toEqual([])
    expect(warmupRows(HEAVY, 0, 5)).toEqual([])
  })

  it('keeps at least one loadable step for very light working weights', () => {
    const rows = warmupRows([{ pct: 0.5, reps: 10 }], 20, 10)
    for (const row of rows) {
      expect(row.weight).toBeGreaterThanOrEqual(10)
      expect(row.weight).toBeLessThan(20)
    }
  })

  it('carries the prescribed reps through untouched', () => {
    expect(warmupRows(HEAVY, 315, 5).map((r) => r.reps)).toEqual([6, 4, 2, 1])
  })
})

describe('reconcileWarmups', () => {
  const plan = [{ pct: 0.5, reps: 6 }, { pct: 0.7, reps: 4 }, { pct: 0.85, reps: 2 }]
  let n = 0
  const makeId = () => `new-${++n}`
  const working = (over: Partial<LoggedSet> = {}): LoggedSet => ({
    id: 'w1', weight: null, reps: null, done: false, warmup: false, completedAt: null, ...over,
  })

  it('builds the ramp the moment a working weight is known', () => {
    const out = reconcileWarmups([working()], plan, 200, 5, makeId)
    expect(out.filter((s) => s.warmup).map((s) => [s.weight, s.reps])).toEqual([
      [100, 6], [140, 4], [170, 2],
    ])
    expect(out[out.length - 1].warmup).toBe(false)
  })

  it('moves the whole ramp when the working weight changes', () => {
    const first = reconcileWarmups([working()], plan, 200, 5, makeId)
    const second = reconcileWarmups(first, plan, 100, 5, makeId)
    expect(second.filter((s) => s.warmup).map((s) => s.weight)).toEqual([50, 70, 85])
  })

  it('never touches a warm-up already logged', () => {
    const logged: LoggedSet = {
      id: 'done-1', weight: 100, reps: 6, done: true, warmup: true, completedAt: 5,
    }
    const out = reconcileWarmups([logged, working()], plan, 300, 5, makeId)
    expect(out[0]).toBe(logged)
    // The logged row counts against the plan, so only what is left is built.
    expect(out.filter((s) => s.warmup && !s.done).map((s) => s.weight)).toEqual([210, 255])
  })

  it('keeps row identity when nothing has to change', () => {
    const first = reconcileWarmups([working()], plan, 200, 5, makeId)
    expect(reconcileWarmups(first, plan, 200, 5, makeId)).toBe(first)
  })

  it('clears the ramp when the working weight goes away', () => {
    const first = reconcileWarmups([working()], plan, 200, 5, makeId)
    const cleared = reconcileWarmups(first, plan, null, 5, makeId)
    expect(cleared.some((s) => s.warmup)).toBe(false)
    expect(cleared).toHaveLength(1)
  })

  it('leaves an exercise with no scheme alone', () => {
    const sets = [working()]
    expect(reconcileWarmups(sets, [], 200, 5, makeId)).toBe(sets)
  })

  it('keeps working sets in order behind the ramp', () => {
    const sets = [working({ id: 'a' }), working({ id: 'b' }), working({ id: 'c' })]
    const out = reconcileWarmups(sets, plan, 100, 5, makeId)
    expect(out.filter((s) => !s.warmup).map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })
})
