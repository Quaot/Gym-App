import type { AppState, LoggedSet, Session, SessionExercise, SleepEntry } from '../types'
import { roundToStep } from './util'
import { warmupRows } from './warmups'

/** Everything generated here is tagged, so removing it never touches your data. */
export const DEMO_PREFIX = 'demo-'

export const isDemo = (id: string): boolean => id.startsWith(DEMO_PREFIX)

/** Deterministic PRNG, so the same seed always builds the same history. */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const dayKeyOf = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface DemoData {
  sessions: Session[]
  sleep: SleepEntry[]
}

/**
 * Twelve weeks of training that behaves like a real training block: weights
 * climb by double progression, the odd session misses, and sleep tracks
 * performance closely enough for the correlation view to have something to
 * find. Every id carries the demo prefix.
 */
export const generateDemoData = (state: AppState, seed = 7, now = Date.now()): DemoData => {
  const rand = mulberry32(seed)
  const program = state.programs.find((p) => p.id === state.activeProgramId) ?? state.programs[0]
  if (!program || program.days.length === 0) return { sessions: [], sleep: [] }

  const sessions: Session[] = []
  const sleep: SleepEntry[] = []
  // Working weight per exercise, carried forward across the block.
  const weights = new Map<string, number>()
  let id = 0

  const WEEKS = 12
  const PER_WEEK = 4
  const total = WEEKS * PER_WEEK

  for (let i = total - 1; i >= 0; i--) {
    const day = program.days[(total - 1 - i) % program.days.length]
    const dayOffset = i * Math.floor(7 / PER_WEEK) + Math.floor(i / PER_WEEK)
    const finishedAt = now - dayOffset * 86400000 - Math.floor(rand() * 6) * 3600000
    if (day.exercises.length === 0) continue

    // Sleep the night before, and how much it helps today.
    const asleepMin = Math.round(330 + rand() * 180)
    sleep.push({
      id: `${DEMO_PREFIX}sleep-${id}`,
      night: dayKeyOf(finishedAt),
      asleepMin,
      inBedMin: asleepMin + Math.round(rand() * 40),
      source: 'health',
    })
    const rested = (asleepMin - 420) / 420 // roughly -0.2 to +0.2

    const exercises: SessionExercise[] = day.exercises.map((t) => {
      const catalogEntry = state.catalog[t.exerciseId]
      const bodyweight = catalogEntry?.bodyweight ?? false
      const increment = catalogEntry?.increment ?? 5

      let weight = weights.get(t.exerciseId)
      if (weight === undefined) {
        // A believable starting load, scaled to the rep range.
        const base = bodyweight ? 0 : 45 + Math.round(rand() * 8) * increment * 2
        weight = bodyweight ? 0 : roundToStep(base, increment)
      }

      // Double progression: mostly climb, occasionally stall.
      const good = rand() > 0.25 + Math.max(0, -rested)
      const topReps = good ? t.repHigh : Math.max(t.repLow, t.repHigh - 1 - Math.floor(rand() * 2))
      const sets: LoggedSet[] = []

      const warm = warmupRows(t.warmups, weight > 0 ? weight : null, increment)
      let stamp = finishedAt - (t.sets + warm.length) * 4 * 60000
      for (const row of warm) {
        sets.push({
          id: `${DEMO_PREFIX}set-${id++}`,
          weight: row.weight,
          reps: row.reps,
          done: true,
          warmup: true,
          completedAt: stamp,
        })
        stamp += 2 * 60000
      }
      for (let s = 0; s < t.sets; s++) {
        const fade = s === 0 ? 0 : Math.floor(rand() * 2)
        sets.push({
          id: `${DEMO_PREFIX}set-${id++}`,
          weight: bodyweight ? null : weight,
          reps: Math.max(1, topReps - fade),
          done: true,
          warmup: false,
          completedAt: stamp,
        })
        stamp += Math.round((t.restSec + 30 + rand() * 60) * 1000)
      }

      // Earn the next jump by topping the range on every set.
      if (good && !bodyweight) weights.set(t.exerciseId, weight + increment)
      else weights.set(t.exerciseId, weight)

      return {
        id: `${DEMO_PREFIX}ex-${id++}`,
        exerciseId: t.exerciseId,
        name: catalogEntry?.name ?? 'Exercise',
        repLow: t.repLow,
        repHigh: t.repHigh,
        repCap: t.repCap,
        restSec: t.restSec,
        warmupPlan: t.warmups,
        notes: t.notes,
        sets,
      }
    })

    const startedAt = Math.min(
      ...exercises.flatMap((e) => e.sets.map((s) => s.completedAt ?? finishedAt)),
    ) - 8 * 60000

    sessions.push({
      id: `${DEMO_PREFIX}sess-${id++}`,
      programId: program.id,
      dayId: day.id,
      dayName: day.name,
      dayNotes: day.notes,
      startedAt,
      finishedAt,
      exercises,
      notes: '',
    })
  }

  return { sessions, sleep }
}
