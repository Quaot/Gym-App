import type { LoggedSet, WarmupStep } from '../types'
import { roundToStep } from './util'

export interface WarmupRow {
  weight: number
  reps: number
}

/**
 * Turns a warm-up scheme into loadable sets for the day's working weight.
 * Each step rounds down to something the plates can make, and a step that
 * lands on the same weight as the one before it is dropped: two identical
 * warm-up sets are a waste of a rest period.
 */
export const warmupRows = (
  plan: WarmupStep[],
  workingWeight: number | null,
  increment: number,
): WarmupRow[] => {
  if (plan.length === 0 || workingWeight === null || workingWeight <= 0) return []
  const step = increment > 0 ? increment : 5

  const rows: WarmupRow[] = []
  for (const { pct, reps } of plan) {
    const raw = pct * workingWeight
    // Round down: a warm-up should never outweigh its own prescription.
    const weight = Math.max(step, Math.floor(raw / step + 1e-9) * step)
    if (weight >= workingWeight) continue
    if (rows.length > 0 && rows[rows.length - 1].weight === weight) continue
    rows.push({ weight, reps })
  }
  return rows
}

/** The share of the working weight a warm-up row represents. */
export const warmupPct = (weight: number, workingWeight: number): number =>
  workingWeight > 0 ? weight / workingWeight : 0

export { roundToStep }

/**
 * The set list a working weight implies, given what is already there.
 *
 * Warm-up rows are generated, not typed, so they follow the weight you are
 * about to lift: they appear the first time that weight is known, and they
 * move with it if it changes before you start. Anything you have already
 * logged is untouchable, and working sets are never reordered or rewritten.
 * Returns the same array when nothing needs to change, so a caller can use
 * identity to decide whether to dispatch.
 */
export const reconcileWarmups = (
  sets: LoggedSet[],
  plan: WarmupStep[],
  workingWeight: number | null,
  increment: number,
  makeId: () => string,
): LoggedSet[] => {
  const done = sets.filter((s) => s.warmup && s.done)
  const working = sets.filter((s) => !s.warmup)
  const pending = sets.filter((s) => s.warmup && !s.done)

  const wanted = warmupRows(plan, workingWeight, increment)
  // Rows already logged count against the plan: you do not warm up twice.
  const remaining = wanted.slice(done.length)

  const same =
    remaining.length === pending.length &&
    remaining.every((row, i) => pending[i].weight === row.weight && pending[i].reps === row.reps)
  if (same) return sets

  const rebuilt: LoggedSet[] = remaining.map((row, i) => ({
    id: pending[i]?.id ?? makeId(),
    weight: row.weight,
    reps: row.reps,
    done: false,
    warmup: true,
    completedAt: null,
  }))

  return [...done, ...rebuilt, ...working]
}
