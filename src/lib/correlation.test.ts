import { describe, expect, it } from 'vitest'
import {
  correlationPoints, linearFit, pearson, sleepBuckets, sleepCorrelation,
} from './correlation'
import type { LoggedSet, Session, SleepEntry } from '../types'

describe('pearson', () => {
  it('matches a textbook dataset to 1e-9', () => {
    // Anscombe's quartet, set I: r = 0.81642051634484 (known value).
    const xs = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5]
    const ys = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68]
    expect(pearson(xs, ys)).toBeCloseTo(0.81642051634484, 9)
  })

  it('gives ±1 for perfect (anti-)correlation', () => {
    expect(pearson([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 12)
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 12)
  })

  it('returns 0, never NaN, for constant series and tiny inputs', () => {
    expect(pearson([5, 5, 5], [1, 2, 3])).toBe(0)
    expect(pearson([1, 2, 3], [7, 7, 7])).toBe(0)
    expect(pearson([1], [2])).toBe(0)
    expect(pearson([], [])).toBe(0)
  })
})

describe('linearFit', () => {
  it('recovers a known line', () => {
    // y = 3 + 2x
    const { a, b } = linearFit([0, 1, 2, 3], [3, 5, 7, 9])
    expect(a).toBeCloseTo(3, 12)
    expect(b).toBeCloseTo(2, 12)
  })
})

/* ------------------------------------------------------------------ *
 *  Session/sleep fixtures
 * ------------------------------------------------------------------ */
let n = 0
const done = (weight: number, reps: number): LoggedSet => ({
  id: `s${n++}`, weight, reps, done: true, warmup: false, completedAt: null,
})

const sessionOn = (iso: string, dayName: string, volume: number): Session => ({
  id: `sess${n++}`,
  programId: null, dayId: null, dayName, dayNotes: '',
  startedAt: new Date(iso).getTime() - 3_600_000,
  finishedAt: new Date(iso).getTime(),
  exercises: [{
    id: `e${n++}`, exerciseId: 'bench', name: 'Bench', repLow: 5, repHigh: 8,
    restSec: 120, notes: '', sets: [done(volume / 10, 10)],
  }],
  notes: '',
})

const night = (date: string, asleepMin: number): SleepEntry => ({
  id: `n${n++}`, night: date, asleepMin, inBedMin: null, source: 'health',
})

describe('correlationPoints', () => {
  it('is mix-normalized: scores against same-day-name history only', () => {
    // Push days run ~2000 volume; Legs days ~4000. A normal Legs day must not
    // look like a +100% performance jump over Push days.
    const sessions = [
      sessionOn('2026-08-03T10:00', 'Push', 2000),
      sessionOn('2026-08-05T10:00', 'Legs', 4000),
      sessionOn('2026-08-10T10:00', 'Push', 2000),
      sessionOn('2026-08-12T10:00', 'Legs', 4000),
      sessionOn('2026-08-17T10:00', 'Push', 2100), // +5% vs Push mean
      sessionOn('2026-08-19T10:00', 'Legs', 4000), // typical Legs
    ]
    const sleep = ['2026-08-17', '2026-08-19'].map((d) => night(d, 450))
    const points = correlationPoints(sessions, sleep)
    expect(points).toHaveLength(2)
    const push = points.find((p) => p.dayName === 'Push')!
    const legs = points.find((p) => p.dayName === 'Legs')!
    expect(push.performance).toBeCloseTo(2100 / 2000, 6)
    expect(legs.performance).toBeCloseTo(1, 6)
  })

  it('needs two prior same-name sessions and a previous-night entry', () => {
    const sessions = [
      sessionOn('2026-08-03T10:00', 'Push', 2000),
      sessionOn('2026-08-10T10:00', 'Push', 2000), // only 1 prior — skipped
      sessionOn('2026-08-17T10:00', 'Push', 2000), // 2 priors but no sleep
      sessionOn('2026-08-24T10:00', 'Push', 2000), // 3 priors + sleep — counts
    ]
    const sleep = [night('2026-08-24', 480)]
    const points = correlationPoints(sessions, sleep)
    expect(points).toHaveLength(1)
    expect(points[0].sessionId).toBe(sessions[3].id)
  })
})

describe('sleepBuckets', () => {
  it('partitions every point exactly once', () => {
    const points = [300, 360, 380, 420, 421, 479, 480, 600].map((sleepMin, i) => ({
      sessionId: `p${i}`, t: i, dayName: 'Push', sleepMin, performance: 1,
    }))
    const buckets = sleepBuckets(points)
    // <6h: 300 · 6-7h: 360,380 · 7-8h: 420,421,479 · 8h+: 480,600
    expect(buckets.map((b) => b.sessions)).toEqual([1, 2, 3, 2])
    expect(buckets.reduce((a, b) => a + b.sessions, 0)).toBe(points.length)
  })

  it('computes the mean delta per bucket and null for empty ones', () => {
    const buckets = sleepBuckets([
      { sessionId: 'a', t: 1, dayName: 'P', sleepMin: 480, performance: 1.06 },
      { sessionId: 'b', t: 2, dayName: 'P', sleepMin: 500, performance: 1.02 },
    ])
    expect(buckets[3].meanDelta).toBeCloseTo(0.04, 10)
    expect(buckets[0].meanDelta).toBeNull()
  })
})

describe('sleepCorrelation end-to-end', () => {
  it('finds the planted positive relationship', () => {
    // Performance engineered to rise with sleep.
    const sessions: Session[] = []
    const sleep: SleepEntry[] = []
    const base = new Date('2026-06-01T10:00').getTime()
    for (let i = 0; i < 12; i++) {
      const iso = new Date(base + i * 4 * 86400000).toISOString()
      const sleepMin = 360 + i * 12
      const volume = 2000 * (0.9 + (sleepMin - 360) / 1440) // rises with sleep
      sessions.push(sessionOn(iso, 'Push', volume))
      const d = new Date(base + i * 4 * 86400000)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      sleep.push(night(key, sleepMin))
    }
    const { r, points, fit } = sleepCorrelation(sessions, sleep)
    expect(points.length).toBeGreaterThanOrEqual(8)
    expect(r).toBeGreaterThan(0.5)
    expect(fit.b).toBeGreaterThan(0)
  })
})
