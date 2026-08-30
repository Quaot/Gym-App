import type { AppState, ID, Session } from '../types'
import { bestSet, est1RM, finishedSessions, sessionVolume, workingSets } from './history'

/** 'YYYY-MM-DD' in local time. */
export const dayKey = (ts: number): string => {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Monday-based start of the ISO week containing ts, as a local date key. */
export const weekKey = (ts: number): string => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7 // Mon=0
  d.setDate(d.getDate() - dow)
  return dayKey(d.getTime())
}

export interface TrendPoint {
  t: number
  /** Best-set score: Epley e1RM, or reps for bodyweight movements. */
  score: number
  weight: number | null
  reps: number
  isPR: boolean
}

/** Per-session best-set trend for one exercise, oldest first, with PR flags. */
export const exerciseTrend = (state: AppState, exerciseId: ID): TrendPoint[] => {
  const bodyweight = state.catalog[exerciseId]?.bodyweight ?? false
  const points: TrendPoint[] = []
  const sessions = finishedSessions(state.sessions).slice().reverse()
  let best = 0
  for (const session of sessions) {
    for (const e of session.exercises) {
      if (e.exerciseId !== exerciseId) continue
      const top = bestSet(e, bodyweight)
      if (!top) continue
      const score = est1RM(top, bodyweight)
      // The first session on a movement is a baseline, not a record. This is
      // the rule recordsIn already applies during a workout, and the chart
      // used to disagree with it and count one PR too many for every lift.
      const isPR = best > 0 && score > best
      best = Math.max(best, score)
      points.push({
        t: session.finishedAt ?? session.startedAt,
        score: Math.round(score * 10) / 10,
        weight: top.weight,
        reps: top.reps ?? 0,
        isPR,
      })
    }
  }
  return points
}

export interface WeekBucket {
  weekStart: string
  volume: number
  sessions: number
  sets: number
}

/** Weekly volume/frequency buckets over the trailing `weeks`, zero-filled. */
export const weeklyBuckets = (sessions: Session[], weeks: number, now: number): WeekBucket[] => {
  const buckets = new Map<string, WeekBucket>()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const dow = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - dow - 7 * (weeks - 1))
  for (let i = 0; i < weeks; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i * 7)
    const key = dayKey(d.getTime())
    buckets.set(key, { weekStart: key, volume: 0, sessions: 0, sets: 0 })
  }
  for (const s of finishedSessions(sessions)) {
    const key = weekKey(s.finishedAt ?? s.startedAt)
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.volume += sessionVolume(s)
    bucket.sessions += 1
    bucket.sets += s.exercises.reduce((n, e) => n + workingSets(e).length, 0)
  }
  return [...buckets.values()]
}

export interface CalendarDay {
  key: string
  /** Day of month, 1-31. */
  day: number
  /** 0 = no training; otherwise total working sets. */
  sets: number
}

/** Every day of the month containing `monthTs`, with per-day set counts. */
export const calendarDays = (sessions: Session[], monthTs: number): CalendarDay[] => {
  const setsByDay = new Map<string, number>()
  for (const s of finishedSessions(sessions)) {
    const key = dayKey(s.finishedAt ?? s.startedAt)
    const sets = s.exercises.reduce((n, e) => n + workingSets(e).length, 0)
    setsByDay.set(key, (setsByDay.get(key) ?? 0) + sets)
  }
  const base = new Date(monthTs)
  const year = base.getFullYear()
  const month = base.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const out: CalendarDay[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const key = dayKey(new Date(year, month, day).getTime())
    out.push({ key, day, sets: setsByDay.get(key) ?? 0 })
  }
  return out
}

/** Exercises ordered by most recently trained, for the Progress list. */
export const exercisesByRecency = (state: AppState): { id: ID; name: string; lastAt: number }[] => {
  const lastAt = new Map<ID, number>()
  for (const s of finishedSessions(state.sessions)) {
    const t = s.finishedAt ?? s.startedAt
    for (const e of s.exercises) {
      if (workingSets(e).length === 0) continue
      if (!lastAt.has(e.exerciseId)) lastAt.set(e.exerciseId, t)
    }
  }
  return [...lastAt.entries()]
    .map(([id, at]) => ({ id, name: state.catalog[id]?.name ?? 'Exercise', lastAt: at }))
    .sort((a, b) => b.lastAt - a.lastAt)
}

/* Memoization: analytics recompute only when the sessions array identity
 * changes (the reducer guarantees a new array per real edit). */
const memo = new WeakMap<Session[], Map<string, unknown>>()

export const memoized = <T>(sessions: Session[], key: string, compute: () => T): T => {
  let bag = memo.get(sessions)
  if (!bag) {
    bag = new Map()
    memo.set(sessions, bag)
  }
  if (!bag.has(key)) bag.set(key, compute())
  return bag.get(key) as T
}
