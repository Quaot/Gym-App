import { beforeEach, describe, expect, it } from 'vitest'
import { initStore, getStore } from './store'
import { act } from './actions'
import { freshState } from './migrate'
import type { AppState, WarmupStep } from '../types'

const RAMP: WarmupStep[] = [
  { pct: 0.5, reps: 6 }, { pct: 0.7, reps: 4 }, { pct: 0.85, reps: 2 }, { pct: 0.9, reps: 1 },
]

/** A programme whose fourth movement carries a ramp it should never get. */
const stateWithStrayWarmups = (): AppState => {
  const base = freshState()
  return {
    ...base,
    programs: base.programs.map((p) => ({
      ...p,
      days: p.days.map((d) => ({
        ...d,
        exercises: d.exercises.map((t, i) => (i === 3 ? { ...t, warmups: RAMP } : t)),
      })),
    })),
  }
}

const live = () => {
  const s = getStore().getState()
  return s.sessions.find((x) => x.id === s.activeSessionId)!
}

describe('starting a workout', () => {
  beforeEach(() => {
    initStore(stateWithStrayWarmups())
  })

  it('never builds warm-up rows for anything but the first exercise', () => {
    const day = getStore().getState().programs[0].days[0]
    act.startSession(day.id)
    const session = live()
    session.exercises.forEach((e, i) => {
      if (i === 0) return
      expect(e.sets.filter((x) => x.warmup), `${e.name}`).toHaveLength(0)
      expect(e.warmupPlan, `${e.name} plan`).toEqual([])
    })
  })

  it('leaves the first exercise its plan, so the rule is a limit and not a ban', () => {
    const day = getStore().getState().programs[0].days[0]
    act.startSession(day.id)
    expect(live().exercises[0].warmupPlan.length).toBeGreaterThan(0)
  })

  it('gives every exercise at least one set to log', () => {
    const day = getStore().getState().programs[0].days[0]
    act.startSession(day.id)
    for (const e of live().exercises) expect(e.sets.length, e.name).toBeGreaterThan(0)
  })

  it('will not start a second workout while one is live', () => {
    const days = getStore().getState().programs[0].days
    act.startSession(days[0].id)
    const first = getStore().getState().activeSessionId
    act.startSession(days[1].id)
    expect(getStore().getState().activeSessionId).toBe(first)
    expect(getStore().getState().sessions).toHaveLength(1)
  })

  it('does nothing at all for a day that is not there', () => {
    act.startSession('no-such-day')
    expect(getStore().getState().activeSessionId).toBeNull()
  })
})
