import type { AppState, ID, LoggedSet, Session, SessionExercise } from '../types'

export const workingSets = (e: SessionExercise): LoggedSet[] =>
  e.sets.filter((s) => s.done && !s.warmup && s.reps !== null)

/**
 * The rows the rep range describes, logged or not. Distinct from workingSets,
 * which is only the ones you have already done.
 */
export const workingRows = (e: SessionExercise): LoggedSet[] =>
  e.sets.filter((s) => !s.warmup)

export const warmupSets = (e: SessionExercise): LoggedSet[] =>
  e.sets.filter((s) => s.done && s.warmup && s.reps !== null)

/** Epley estimate, used to rank sets. Bodyweight movements rank by reps. */
export const est1RM = (s: LoggedSet, bodyweight: boolean): number => {
  if (s.reps === null) return 0
  if (bodyweight || s.weight === null) return s.reps
  return s.weight * (1 + s.reps / 30)
}

export const bestSet = (e: SessionExercise, bodyweight: boolean): LoggedSet | null =>
  workingSets(e).reduce<LoggedSet | null>(
    (best, s) => (best === null || est1RM(s, bodyweight) > est1RM(best, bodyweight) ? s : best),
    null,
  )

export interface HistoryEntry {
  session: Session
  exercise: SessionExercise
}

/** Finished sessions, most recently finished first. */
export const finishedSessions = (sessions: Session[]): Session[] =>
  sessions
    .filter((s) => s.finishedAt !== null)
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))

/** Every past appearance of an exercise (by identity), newest first. */
export const exerciseHistory = (
  sessions: Session[],
  exerciseId: ID,
  excludeSessionId?: ID | null,
): HistoryEntry[] =>
  finishedSessions(sessions)
    .filter((s) => s.id !== excludeSessionId)
    .flatMap((session) =>
      session.exercises
        .filter((e) => e.exerciseId === exerciseId && e.sets.some((x) => x.done))
        .map((exercise) => ({ session, exercise })),
    )

export const lastPerformance = (
  sessions: Session[],
  exerciseId: ID,
  excludeSessionId?: ID | null,
): HistoryEntry | null => exerciseHistory(sessions, exerciseId, excludeSessionId)[0] ?? null

/** Heaviest-ranked set ever recorded for an exercise. */
export const personalBest = (
  state: AppState,
  exerciseId: ID,
  excludeSessionId?: ID | null,
): LoggedSet | null => {
  const bodyweight = state.catalog[exerciseId]?.bodyweight ?? false
  return exerciseHistory(state.sessions, exerciseId, excludeSessionId).reduce<LoggedSet | null>(
    (best, h) => {
      const b = bestSet(h.exercise, bodyweight)
      return b && (best === null || est1RM(b, bodyweight) > est1RM(best, bodyweight)) ? b : best
    },
    null,
  )
}

/** Total load moved. Bodyweight sets contribute reps × weight only if a weight
 *  was logged (weighted pull-ups); pure-bodyweight volume is tracked as reps. */
export const sessionVolume = (s: Session): number =>
  s.exercises.reduce(
    (total, e) =>
      total + workingSets(e).reduce((v, set) => v + (set.weight ?? 0) * (set.reps ?? 0), 0),
    0,
  )

export const sessionReps = (s: Session): number =>
  s.exercises.reduce(
    (total, e) => total + workingSets(e).reduce((v, set) => v + (set.reps ?? 0), 0),
    0,
  )

export const sessionSetCount = (s: Session): number =>
  s.exercises.reduce((n, e) => n + workingSets(e).length, 0)

export const sessionDoneSetCount = (s: Session): number =>
  s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0)

export interface Record1RM {
  /** The set that set it. */
  set: LoggedSet
  /** Its estimated one rep max, or its reps for a bodyweight movement. */
  score: number
  /** What it beat, if anything. */
  previous: number
}

/**
 * Records set during a session, judged against everything logged before it.
 * A record is worth showing the moment it happens, not at the end of the
 * month, so this runs over the live session as you log.
 */
export const recordsIn = (
  state: Pick<AppState, 'sessions' | 'catalog'>,
  session: Session,
): Map<ID, Record1RM> => {
  const out = new Map<ID, Record1RM>()
  for (const exercise of session.exercises) {
    const bodyweight = state.catalog[exercise.exerciseId]?.bodyweight ?? false
    const prior = personalBest(
      { ...state, sessions: state.sessions } as AppState,
      exercise.exerciseId,
      session.id,
    )
    const previous = prior ? est1RM(prior, bodyweight) : 0
    const best = bestSet(exercise, bodyweight)
    if (!best) continue
    const score = est1RM(best, bodyweight)
    // A first ever session is not a record, it is a baseline.
    if (previous > 0 && score > previous) out.set(exercise.id, { set: best, score, previous })
  }
  return out
}
