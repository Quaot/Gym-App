import type { LoggedSet, Session, SessionExercise } from '../types'

export const normalizeName = (name: string) => name.trim().toLowerCase()

export const workingSets = (e: SessionExercise) =>
  e.sets.filter((s) => s.done && !s.warmup && s.reps !== null)

/** Epley estimate, used only to rank sets against each other. */
export const est1RM = (s: LoggedSet) =>
  s.weight === null || s.reps === null ? 0 : s.weight * (1 + s.reps / 30)

export const bestSet = (e: SessionExercise): LoggedSet | null =>
  workingSets(e).reduce<LoggedSet | null>(
    (best, s) => (best === null || est1RM(s) > est1RM(best) ? s : best),
    null,
  )

export interface HistoryEntry {
  session: Session
  exercise: SessionExercise
}

/** Every past appearance of an exercise, newest first. */
export const exerciseHistory = (
  sessions: Session[],
  name: string,
  excludeSessionId?: string | null,
): HistoryEntry[] => {
  const key = normalizeName(name)
  if (!key) return []
  return sessions
    .filter((s) => s.finishedAt !== null && s.id !== excludeSessionId)
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    .flatMap((session) =>
      session.exercises
        .filter((e) => normalizeName(e.name) === key && workingSets(e).length > 0)
        .map((exercise) => ({ session, exercise })),
    )
}

export const lastPerformance = (
  sessions: Session[],
  name: string,
  excludeSessionId?: string | null,
): HistoryEntry | null => exerciseHistory(sessions, name, excludeSessionId)[0] ?? null

/** Heaviest estimated-1RM set ever recorded for an exercise. */
export const personalBest = (
  sessions: Session[],
  name: string,
  excludeSessionId?: string | null,
): LoggedSet | null =>
  exerciseHistory(sessions, name, excludeSessionId).reduce<LoggedSet | null>((best, h) => {
    const b = bestSet(h.exercise)
    return b && (best === null || est1RM(b) > est1RM(best)) ? b : best
  }, null)

export const sessionVolume = (s: Session) =>
  s.exercises.reduce(
    (total, e) =>
      total + workingSets(e).reduce((v, set) => v + (set.weight ?? 0) * (set.reps ?? 0), 0),
    0,
  )

export const sessionSetCount = (s: Session) =>
  s.exercises.reduce((n, e) => n + workingSets(e).length, 0)

/** All exercise names seen in the program or history, for autocomplete. */
export const knownExerciseNames = (sessions: Session[], extra: string[] = []): string[] => {
  const seen = new Map<string, string>()
  for (const name of extra) if (name.trim()) seen.set(normalizeName(name), name.trim())
  for (const s of sessions)
    for (const e of s.exercises) if (e.name.trim()) seen.set(normalizeName(e.name), e.name.trim())
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}
