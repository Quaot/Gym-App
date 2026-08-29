import type { Session, SleepEntry } from '../types'
import { finishedSessions, sessionVolume, sessionReps } from './history'
import { sleepByNight } from './sleep'
import { dayKey } from './analytics'

/** Pearson correlation coefficient. r = 0 for degenerate (constant) series. */
export const pearson = (xs: number[], ys: number[]): number => {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dx2 = 0
  let dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  if (dx2 === 0 || dy2 === 0) return 0
  return num / Math.sqrt(dx2 * dy2)
}

/** Least-squares fit y = a + b·x. */
export const linearFit = (xs: number[], ys: number[]): { a: number; b: number } => {
  const n = Math.min(xs.length, ys.length)
  if (n === 0) return { a: 0, b: 0 }
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  const b = den === 0 ? 0 : num / den
  return { a: my - b * mx, b }
}

/**
 * A session's load in comparable units: volume, or total working reps for
 * pure-bodyweight sessions (no external load logged anywhere).
 */
const sessionLoad = (s: Session): number => {
  const volume = sessionVolume(s)
  return volume > 0 ? volume : sessionReps(s)
}

export interface CorrelationPoint {
  sessionId: string
  t: number
  dayName: string
  sleepMin: number
  /** Session load relative to the trailing mean of SAME-DAY-NAME sessions:
   *  1.0 = typical, 1.05 = 5% above your usual for that workout. */
  performance: number
}

/**
 * Pairs each finished session with the previous night's sleep and scores its
 * load against the trailing mean of sessions with the same day name — so a
 * light Pull day after a heavy Legs day doesn't read as a slump.
 */
export const correlationPoints = (
  sessions: Session[],
  sleep: SleepEntry[],
): CorrelationPoint[] => {
  const nights = sleepByNight(sleep)
  const chronological = finishedSessions(sessions).slice().reverse()
  const trailing = new Map<string, number[]>()
  const out: CorrelationPoint[] = []

  for (const s of chronological) {
    const t = s.finishedAt ?? s.startedAt
    const load = sessionLoad(s)
    const key = s.dayName
    const prior = trailing.get(key) ?? []

    const night = nights.get(dayKey(t))
    if (night && prior.length >= 2 && load > 0) {
      const window = prior.slice(-8)
      const mean = window.reduce((a, b) => a + b, 0) / window.length
      if (mean > 0) {
        out.push({
          sessionId: s.id,
          t,
          dayName: s.dayName,
          sleepMin: night.asleepMin,
          performance: load / mean,
        })
      }
    }

    prior.push(load)
    trailing.set(key, prior)
  }
  return out
}

export interface SleepBucket {
  label: string
  minMin: number
  maxMin: number
  sessions: number
  /** Mean performance delta vs typical, e.g. +0.04 = 4% above. */
  meanDelta: number | null
}

const BUCKETS: [string, number, number][] = [
  ['under 6h', 0, 360],
  ['6 to 7h', 360, 420],
  ['7 to 8h', 420, 480],
  ['over 8h', 480, 24 * 60 + 1],
]

/** Buckets partition points exactly once by previous-night sleep. */
export const sleepBuckets = (points: CorrelationPoint[]): SleepBucket[] =>
  BUCKETS.map(([label, minMin, maxMin]) => {
    const inBucket = points.filter((p) => p.sleepMin >= minMin && p.sleepMin < maxMin)
    const meanDelta =
      inBucket.length > 0
        ? inBucket.reduce((a, p) => a + p.performance, 0) / inBucket.length - 1
        : null
    return { label, minMin, maxMin, sessions: inBucket.length, meanDelta }
  })

export interface CorrelationSummary {
  points: CorrelationPoint[]
  r: number
  fit: { a: number; b: number }
  buckets: SleepBucket[]
}

export const sleepCorrelation = (
  sessions: Session[],
  sleep: SleepEntry[],
): CorrelationSummary => {
  const points = correlationPoints(sessions, sleep)
  const xs = points.map((p) => p.sleepMin)
  const ys = points.map((p) => p.performance)
  return {
    points,
    r: pearson(xs, ys),
    fit: linearFit(xs, ys),
    buckets: sleepBuckets(points),
  }
}
