import type { Session } from '../types'

export interface RestGap {
  /** The set this gap preceded. */
  setId: string
  gapMs: number
}

/** All set completions in a session, chronological. */
const completions = (s: Session): { setId: string; at: number }[] =>
  s.exercises
    .flatMap((e) => e.sets)
    .filter((set) => set.done && set.completedAt !== null)
    .map((set) => ({ setId: set.id, at: set.completedAt! }))
    .sort((a, b) => a.at - b.at)

/**
 * Actual time between consecutive set completions — the honest "how long did
 * I really rest" number, derived rather than stored. The first completion has
 * no preceding gap. Cross-exercise gaps count: walking to the next station is
 * rest too.
 */
export const actualRests = (s: Session): RestGap[] => {
  const done = completions(s)
  const gaps: RestGap[] = []
  for (let i = 1; i < done.length; i++) {
    gaps.push({ setId: done[i].setId, gapMs: done[i].at - done[i - 1].at })
  }
  return gaps
}

/** Gap that preceded one specific set, if known. */
export const restBefore = (s: Session, setId: string): number | null =>
  actualRests(s).find((g) => g.setId === setId)?.gapMs ?? null

export interface SessionTimeSplit {
  totalMs: number
  /** Sum of gaps between completions — time not under the bar. */
  restMs: number
  workMs: number
  avgRestMs: number | null
  setCount: number
}

export const sessionTimeSplit = (s: Session): SessionTimeSplit => {
  const end = s.finishedAt ?? Date.now()
  const totalMs = Math.max(0, end - s.startedAt)
  const gaps = actualRests(s)
  const restMs = Math.min(totalMs, gaps.reduce((sum, g) => sum + g.gapMs, 0))
  return {
    totalMs,
    restMs,
    workMs: totalMs - restMs,
    avgRestMs: gaps.length > 0 ? restMs / gaps.length : null,
    setCount: completions(s).length,
  }
}
