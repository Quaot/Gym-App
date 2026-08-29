import type { LoggedSet } from '../types'
import { roundToStep } from './util'

/**
 * Double progression, adapted to the equipment in front of you.
 *
 * Hold the weight and add reps until every working set reaches the top of the
 * range. Then look at what the smallest available jump costs: on a heavy
 * barbell it is a couple of percent and you take it, landing near the bottom
 * of the range. On a light dumbbell the same jump can be a quarter of the
 * load, which would throw you out of the range entirely, so the range widens
 * instead until the jump lands inside it.
 *
 * That is why compound and isolation are not hard coded here. The deciding
 * number is the jump as a share of the working weight.
 */

/** One rep costs about 3% of load in the 5 to 12 rep zone (Epley implied). */
export const REP_COST = 0.03
/** A jump this small barely costs a rep. */
export const JUMP_OK = 0.05
/** Past this, a jump is refused and the range widens instead. */
export const JUMP_MAX = 0.1
/** A jump past this lands you at the bottom of the range. */
export const JUMP_HARD = 0.07
/** Sessions without a rep or load gain before a deload is offered. */
export const STALL_N = 3
export const DELOAD = 0.1

export interface ProgressionExercise {
  repLow: number
  repHigh: number
  /** How far repHigh may stretch before a jump is forced. */
  repCap: number
  /** Smallest loadable jump, in the user's unit. */
  increment: number
  bodyweight: boolean
  /** Working sets programmed for the session. */
  plannedSets: number
  /**
   * Load carried on top of the bar or stack, which for a bodyweight movement
   * is the lifter. A jump is judged against weight plus this.
   */
  systemLoad?: number
}

/** One past session's working sets for this exercise, newest first. */
export type PastSets = LoggedSet[]

export type Suggestion =
  /** Nothing logged yet. */
  | { kind: 'first'; weight: null; targetReps: number }
  /** Same weight, climb the range. */
  | { kind: 'reps'; weight: number; targetReps: number; perSetTargets: number[] }
  /** The range is topped and the jump is affordable. */
  | { kind: 'load'; weight: number; targetReps: number }
  /** The jump costs too much, so widen the range first. */
  | { kind: 'extend'; weight: number; targetReps: number; newRepHigh: number }
  /** Range exhausted and the jump still too costly: add volume. */
  | { kind: 'addSet'; weight: number; targetReps: number; sets: number }
  /** The last jump missed the range; step back and build. */
  | { kind: 'revert'; weight: number; targetReps: number; newRepHigh: number }
  /** Three sessions stuck: take 10% off and climb again. */
  | { kind: 'deload'; weight: number; targetReps: number }

export interface SuggestionOut {
  suggestion: Suggestion
  /** One sentence, shown on long press. */
  reason: string
}

/**
 * Epley. Used to compare a lifter against themselves, never to publish a one
 * rep max, so the reps are not clamped: fitting and inverting the same curve
 * keeps the landing prediction self consistent, which matters more here than
 * absolute accuracy at high reps.
 */
const epley = (weight: number, reps: number) => weight * (1 + reps / 30)

/** Reps Epley predicts at a new weight, given an estimated one rep max. */
const predictedReps = (e1rm: number, weight: number) =>
  weight <= 0 ? 0 : 30 * (e1rm / weight - 1)

/**
 * Best set of a session, scored in whole-system load so a weighted pull-up
 * and a bare one sit on the same scale. With nothing to weigh (no load and no
 * bodyweight on file) it falls back to raw reps.
 */
const best1RM = (sets: PastSets, systemLoad: number): number =>
  sets.reduce((best, s) => {
    if (s.reps === null) return best
    const load = (s.weight ?? 0) + systemLoad
    return Math.max(best, load > 0 ? epley(load, s.reps) : s.reps)
  }, 0)

/** The weight most of the working sets were done at. */
const workingWeight = (sets: PastSets): number | null => {
  const weights = sets.map((s) => s.weight).filter((w): w is number => w !== null)
  if (weights.length === 0) return null
  const counts = new Map<number, number>()
  for (const w of weights) counts.set(w, (counts.get(w) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
}

/** The next loadable weight strictly above this one. */
const nextLoadable = (weight: number, increment: number): number =>
  (Math.floor(weight / increment + 1e-9) + 1) * increment

const repsOf = (sets: PastSets): number[] =>
  sets.map((s) => s.reps).filter((r): r is number => r !== null)

/** No rep gain and no load gain across the window. */
const isStalled = (history: PastSets[], systemLoad: number): boolean => {
  if (history.length < STALL_N) return false
  const window = history.slice(0, STALL_N)
  const scores = window.map((sets) => best1RM(sets, systemLoad))
  const bestReps = window.map((sets) => Math.max(0, ...repsOf(sets)))
  const noLoadGain = scores.every((s) => s <= scores[scores.length - 1] + 1e-9)
  const noRepGain = bestReps.every((r) => r <= bestReps[bestReps.length - 1])
  return noLoadGain && noRepGain
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/**
 * Suggests the next session's weight and reps.
 *
 * @param history working sets per past session, newest first
 * @param ex the exercise's range, increment and type
 */
export const suggestProgression = (
  history: PastSets[],
  ex: ProgressionExercise,
): SuggestionOut => {
  const { repLow, repHigh, repCap, increment, bodyweight, plannedSets } = ex
  const systemLoad = ex.systemLoad ?? 0
  const past = history.filter((sets) => sets.length > 0)

  if (past.length === 0) {
    return {
      suggestion: { kind: 'first', weight: null, targetReps: repLow },
      reason: `Find a weight you can hold for ${repLow} clean reps. That is your baseline.`,
    }
  }

  const last = past[0]
  const lastReps = repsOf(last)
  const weight = workingWeight(last) ?? 0
  // Scored in system load, so the landing prediction below compares like
  // with like when a belt is involved.
  const e1rm = Math.max(...past.slice(0, 3).map((sets) => best1RM(sets, systemLoad)))

  // Bodyweight with no added load climbs reps, then sets, then load.
  if (bodyweight && weight === 0) {
    const allTopped = lastReps.length > 0 && lastReps.every((r) => r >= repHigh)
    if (!allTopped) {
      return {
        suggestion: {
          kind: 'reps',
          weight: 0,
          targetReps: Math.min(repHigh, Math.max(...lastReps) + 1),
          perSetTargets: lastReps.map((r) => Math.min(repHigh, r + 1)),
        },
        reason: `Add a rep where you can. ${repHigh} on every set unlocks the next step.`,
      }
    }
    if (repHigh < repCap) {
      return {
        suggestion: {
          kind: 'extend',
          weight: 0,
          targetReps: Math.min(repCap, repHigh + 2),
          newRepHigh: Math.min(repCap, repHigh + 2),
        },
        reason: `You own ${repHigh} reps. Push the range to ${Math.min(repCap, repHigh + 2)} before adding weight.`,
      }
    }
    return {
      suggestion: { kind: 'addSet', weight: 0, targetReps: repLow, sets: plannedSets + 1 },
      reason: `The range is maxed. Add a set, or start hanging weight from a belt.`,
    }
  }

  // A jump taken last session that landed short of the range is a bad jump.
  const previous = past[1]
  if (previous) {
    const prevWeight = workingWeight(previous)
    if (prevWeight !== null && weight > prevWeight && lastReps.length > 0) {
      if (lastReps[0] < repLow - 1) {
        const newRepHigh = Math.min(repCap, repHigh + 2)
        return {
          suggestion: { kind: 'revert', weight: prevWeight, targetReps: newRepHigh, newRepHigh },
          reason: `${weight} was a reach. Go back to ${prevWeight} and build to ${newRepHigh} reps first.`,
        }
      }
    }
  }

  if (isStalled(past, systemLoad)) {
    const deloaded = roundToStep(weight * (1 - DELOAD), increment)
    return {
      suggestion: { kind: 'deload', weight: deloaded, targetReps: repHigh },
      reason: `Three sessions stuck. Drop to ${deloaded} and climb back with room to spare.`,
    }
  }

  const allTopped = lastReps.length > 0 && lastReps.every((r) => r >= repHigh)

  if (!allTopped) {
    const perSetTargets = lastReps.map((r) => Math.min(repHigh, r + 1))
    const lagging = lastReps.findIndex((r) => r < repHigh)
    return {
      suggestion: {
        kind: 'reps',
        weight,
        targetReps: Math.min(repHigh, Math.max(...lastReps) + 1),
        perSetTargets,
      },
      reason:
        lagging > 0
          ? `Bring set ${lagging + 1} up to ${repHigh}. Every set at ${repHigh} earns the next jump.`
          : `Add a rep. Every set at ${repHigh} earns the next jump.`,
    }
  }

  // Topped out. What does the smallest jump cost against everything you carry?
  const carried = weight + systemLoad
  const jump = carried > 0 ? increment / carried : 1
  const newWeight = nextLoadable(weight, increment)
  const landing = predictedReps(e1rm, newWeight + systemLoad)

  if (jump <= JUMP_MAX && landing >= repLow - 1) {
    const drop = Math.round(jump / REP_COST)
    const target = jump > JUMP_HARD ? repLow : Math.min(repHigh, Math.max(repLow, repHigh - drop))
    return {
      suggestion: { kind: 'load', weight: newWeight, targetReps: target },
      reason: `You topped the range. ${increment} more is ${pct(jump)}, so expect about ${target} reps.`,
    }
  }

  if (repHigh < repCap) {
    const newRepHigh = Math.min(repCap, repHigh + 2)
    return {
      suggestion: { kind: 'extend', weight, targetReps: newRepHigh, newRepHigh },
      reason: `The smallest jump here is ${pct(jump)}, too steep. Build to ${newRepHigh} reps first.`,
    }
  }

  return {
    suggestion: { kind: 'addSet', weight, targetReps: repLow, sets: plannedSets + 1 },
    reason: `The range is maxed and ${pct(jump)} is too big a jump. Add a set instead.`,
  }
}
