import type { WarmupStep } from '../types'
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
