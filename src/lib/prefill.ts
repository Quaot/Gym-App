import type { AppState, LoggedSet, Session, SessionExercise } from '../types'
import { lastPerformance, warmupSets, workingSets } from './history'
import { roundToStep } from './util'
import { suggestionFor } from './suggest'

export interface Prefill {
  weight: number | null
  reps: number | null
}

const values = (s: LoggedSet): Prefill => ({ weight: s.weight, reps: s.reps })

/**
 * What an untouched set should assume when the user completes it — and what
 * the ghost display shows beforehand. The two are the same value by contract
 * (the UI renders exactly this and completeSet commits exactly this).
 *
 * Working sets match last session by WORKING ordinal (warm-up rows don't shift
 * the mapping), and never inherit warm-up weights. Warm-up rows only inherit
 * from warm-ups, falling back to half the first working weight.
 */
export type PrefillState = Pick<AppState, 'sessions' | 'settings' | 'catalog'>

export const prefillFor = (
  state: PrefillState,
  session: Session,
  exercise: SessionExercise,
  index: number,
): Prefill => {
  const set = exercise.sets[index]
  if (!set) return { weight: null, reps: null }

  const last = lastPerformance(state.sessions, exercise.exerciseId, session.id)
  const lastWorking = last ? workingSets(last.exercise) : []

  const before = exercise.sets.slice(0, index)

  if (set.warmup) {
    // 1. The previous warm-up logged today.
    const prevWarm = [...before].reverse().find((s) => s.warmup && s.reps !== null)
    if (prevWarm) return values(prevWarm)

    // 2. Last session's warm-up at this warm-up ordinal (else its last one).
    const lastWarm = last ? warmupSets(last.exercise) : []
    const ordinal = before.filter((s) => s.warmup).length
    const match = lastWarm[ordinal] ?? lastWarm[lastWarm.length - 1]
    if (match) return values(match)

    // 3. Half the first working weight, on the weight-step grid.
    const firstWorking =
      exercise.sets.find((s) => !s.warmup && s.weight !== null) ?? lastWorking[0]
    const weight =
      firstWorking?.weight != null
        ? roundToStep(firstWorking.weight / 2, state.settings.weightStep)
        : null
    return { weight, reps: 10 }
  }

  // Working set: carry today's previous working set first.
  const prevWork = [...before].reverse().find((s) => !s.warmup && s.reps !== null)
  if (prevWork) return values(prevWork)

  // Then what progression says to do next. The engine reasons about straight
  // sets, so a session that ramped weight across sets keeps its own shape and
  // falls through to the ordinal carry below.
  const lastWasStraight =
    lastWorking.length <= 1 ||
    lastWorking.every((s) => s.weight === lastWorking[0].weight)
  const { suggestion } = lastWasStraight
    ? suggestionFor(state, exercise, session.id)
    : { suggestion: { kind: 'first' as const, weight: null, targetReps: 0 } }
  if (suggestion.kind !== 'first' && suggestion.weight !== null) {
    const perSet =
      suggestion.kind === 'reps' ? suggestion.perSetTargets[before.filter((s) => !s.warmup).length] : undefined
    return {
      weight: suggestion.weight > 0 ? suggestion.weight : null,
      reps: perSet ?? suggestion.targetReps,
    }
  }

  // Then last session's working set at the same working ordinal.
  const ordinal = before.filter((s) => !s.warmup).length
  const match = lastWorking[ordinal] ?? lastWorking[lastWorking.length - 1]
  if (match) return values(match)

  // First time ever: aim at the bottom of the programmed range.
  return { weight: null, reps: exercise.repLow }
}

export interface FillPlan {
  /** The value each set would take, in the exercise's own set order. */
  values: Prefill[]
  /** Where the numbers came from, in words, for the button that applies them. */
  source: string
  /** Sets that would actually change. */
  changes: number
}

/**
 * What "fill this in for me" would do, and where each number came from.
 *
 * The same rules the ghost text has always used, gathered into something the
 * user can read before committing to it. Sets already logged are never
 * touched, and a set the user typed into is left alone as well.
 */
export const fillPlanFor = (
  state: PrefillState,
  session: Session,
  exercise: SessionExercise,
): FillPlan => {
  // Threaded, not independent: a set's suggestion can depend on the one above
  // it, so each value is worked out against the rows already filled. That is
  // what makes pressing the button twice do nothing the second time.
  let filled = exercise
  const values: Prefill[] = []
  exercise.sets.forEach((set, i) => {
    const value = prefillFor(state, session, filled, i)
    values.push(value)
    if (set.done) return
    filled = {
      ...filled,
      sets: filled.sets.map((s, j) =>
        j === i ? { ...s, weight: value.weight, reps: value.reps } : s,
      ),
    }
  })
  const changes = exercise.sets.filter((set, i) => {
    if (set.done) return false
    const fill = values[i]
    return (
      (fill.weight !== null && set.weight !== fill.weight) ||
      (fill.reps !== null && set.reps !== fill.reps)
    )
  }).length

  const last = lastPerformance(state.sessions, exercise.exerciseId, session.id)
  const lastWorking = last ? workingSets(last.exercise) : []
  const straight =
    lastWorking.length <= 1 || lastWorking.every((s) => s.weight === lastWorking[0].weight)
  const source = !last
    ? 'the bottom of the rep range, since this is your first time on it'
    : straight
      ? 'last time, with the increase the app suggests'
      : 'last time, set for set'

  return { values, source, changes }
}
