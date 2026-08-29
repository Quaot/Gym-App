import { describe, expect, it } from 'vitest'
import { generateDemoData, DEMO_PREFIX, isDemo } from './demo'
import { freshState } from '../store/migrate'
import { reducer } from '../store/reducer'
import { workingSets } from './history'

const state = freshState()
const NOW = new Date('2026-08-29T18:00:00Z').getTime()

describe('generateDemoData', () => {
  const { sessions, sleep } = generateDemoData(state, 7, NOW)

  it('builds a full block of finished sessions', () => {
    expect(sessions.length).toBeGreaterThanOrEqual(40)
    for (const s of sessions) {
      expect(s.finishedAt).not.toBeNull()
      expect(s.startedAt).toBeLessThan(s.finishedAt!)
      expect(s.exercises.length).toBeGreaterThan(0)
    }
  })

  it('tags every generated id so removal can be exact', () => {
    for (const s of sessions) {
      expect(isDemo(s.id)).toBe(true)
      for (const e of s.exercises) {
        expect(isDemo(e.id)).toBe(true)
        for (const set of e.sets) expect(isDemo(set.id)).toBe(true)
      }
    }
    for (const night of sleep) expect(isDemo(night.id)).toBe(true)
  })

  it('is deterministic for a given seed and different across seeds', () => {
    const again = generateDemoData(state, 7, NOW)
    expect(JSON.stringify(again)).toBe(JSON.stringify({ sessions, sleep }))
    const other = generateDemoData(state, 9, NOW)
    expect(JSON.stringify(other)).not.toBe(JSON.stringify({ sessions, sleep }))
  })

  it('logs sets that pass the app invariants', () => {
    for (const s of sessions) {
      for (const e of s.exercises) {
        for (const set of e.sets) {
          expect(set.done).toBe(true)
          expect(set.reps).not.toBeNull()
          expect(set.completedAt).not.toBeNull()
        }
      }
    }
  })

  it('progresses weight over the block rather than staying flat', () => {
    const bench = sessions
      .filter((s) => s.exercises.some((e) => e.exerciseId === 'barbell-bench-press'))
      .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0))
      .map((s) => {
        const e = s.exercises.find((x) => x.exerciseId === 'barbell-bench-press')!
        return workingSets(e)[0]?.weight ?? 0
      })
    expect(bench.length).toBeGreaterThan(3)
    expect(bench[bench.length - 1]).toBeGreaterThan(bench[0])
  })

  it('gives every night a plausible amount of sleep', () => {
    for (const night of sleep) {
      expect(night.asleepMin).toBeGreaterThan(300)
      expect(night.asleepMin).toBeLessThan(540)
      expect(night.night).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('generates warm-up sets below the working weight', () => {
    const withWarmups = sessions
      .flatMap((s) => s.exercises)
      .filter((e) => e.sets.some((x) => x.warmup))
    expect(withWarmups.length).toBeGreaterThan(0)
    for (const e of withWarmups) {
      const top = Math.max(...workingSets(e).map((s) => s.weight ?? 0))
      for (const w of e.sets.filter((x) => x.warmup)) {
        expect(w.weight!).toBeLessThan(top)
      }
    }
  })
})

describe('removing sample data', () => {
  it('removes only what was generated', () => {
    const { sessions, sleep } = generateDemoData(state, 7, NOW)
    const mine = {
      ...state,
      sessions: [
        ...sessions,
        { ...sessions[0], id: 'my-own-session' },
      ],
      sleep: [...sleep, { id: 'my-night', night: '2026-01-01', asleepMin: 400, inBedMin: null, source: 'manual' as const }],
    }
    const cleaned = reducer(mine, { type: 'removeTagged', prefix: DEMO_PREFIX })
    expect(cleaned.sessions.map((s) => s.id)).toEqual(['my-own-session'])
    expect(cleaned.sleep.map((s) => s.id)).toEqual(['my-night'])
  })

  it('clears the active session if it was generated', () => {
    const { sessions } = generateDemoData(state, 7, NOW)
    const live = { ...state, sessions, activeSessionId: sessions[0].id }
    expect(reducer(live, { type: 'removeTagged', prefix: DEMO_PREFIX }).activeSessionId).toBeNull()
  })
})
