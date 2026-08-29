import type { AppState, ID, Session, SessionExercise } from '../types'
import { exerciseHistory, workingSets } from './history'
import { memoized } from './analytics'
import { suggestProgression } from './progression'
import type { PastSets, SuggestionOut } from './progression'

/**
 * Bridges stored history to the progression engine: gathers the last few
 * sessions of an exercise, describes the exercise in the engine's terms, and
 * caches the answer per sessions array.
 */
export const suggestionFor = (
  state: Pick<AppState, 'sessions' | 'settings' | 'catalog'>,
  exercise: SessionExercise,
  excludeSessionId?: ID | null,
): SuggestionOut => {
  const catalogEntry = state.catalog[exercise.exerciseId]
  const bodyweight = catalogEntry?.bodyweight ?? false
  const key = `suggest:${exercise.exerciseId}:${exercise.repLow}:${exercise.repHigh}:${exercise.repCap}:${excludeSessionId ?? ''}`

  return memoized(state.sessions, key, () => {
    const history: PastSets[] = exerciseHistory(
      state.sessions,
      exercise.exerciseId,
      excludeSessionId,
    )
      .slice(0, 6)
      .map((h) => workingSets(h.exercise))

    return suggestProgression(history, {
      repLow: exercise.repLow,
      repHigh: exercise.repHigh,
      repCap: exercise.repCap,
      increment: catalogEntry?.increment ?? state.settings.weightStep,
      bodyweight,
      plannedSets: exercise.sets.filter((s) => !s.warmup).length || 3,
      systemLoad: bodyweight ? state.settings.bodyweight : 0,
    })
  })
}

/** The planned working weight for a session that has not started yet. */
export const plannedWorkingWeight = (
  state: Pick<AppState, 'sessions' | 'settings' | 'catalog'>,
  exercise: SessionExercise,
  excludeSessionId?: ID | null,
): number | null => {
  const { suggestion } = suggestionFor(state, exercise, excludeSessionId)
  return suggestion.weight !== null && suggestion.weight > 0 ? suggestion.weight : null
}

/** Working sets of the most recent finished session, for display. */
export const lastWorkingSets = (
  sessions: Session[],
  exerciseId: ID,
  excludeSessionId?: ID | null,
) => {
  const entry = exerciseHistory(sessions, exerciseId, excludeSessionId)[0]
  return entry ? workingSets(entry.exercise) : []
}
