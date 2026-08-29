import { describe, expect, it } from 'vitest'
import { warmupRows } from './warmups'

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
