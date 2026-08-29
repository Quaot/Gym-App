import type { AppState, LoggedSet, Session, SessionExercise } from '../types'
import { lastPerformance, warmupSets, workingSets } from './history'

export interface Prefill {
  weight: number | null
  reps: number | null
}

const values = (s: LoggedSet): Prefill => ({ weight: s.weight, reps: s.reps })

const roundToStep = (v: number, step: number): number =>
  Math.max(step, Math.round(v / step) * step)

/**
 * What an untouched set should assume when the user completes it — and what
 * the ghost display shows beforehand. The two are the same value by contract
 * (the UI renders exactly this and completeSet commits exactly this).
 *
 * Working sets match last session by WORKING ordinal (warm-up rows don't shift
 * the mapping), and never inherit warm-up weights. Warm-up rows only inherit
 * from warm-ups, falling back to half the first working weight.
 */
export const prefillFor = (
  state: AppState,
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

  // Then last session's working set at the same working ordinal.
  const ordinal = before.filter((s) => !s.warmup).length
  const match = lastWorking[ordinal] ?? lastWorking[lastWorking.length - 1]
  if (match) return values(match)

  // First time ever: aim at the bottom of the programmed range.
  return { weight: null, reps: exercise.repLow }
}
