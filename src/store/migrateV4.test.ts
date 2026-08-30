import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../types'
import type { AppState, WarmupStep } from '../types'
import { freshState, migrateV4 } from './migrate'

/** What the old per-role policy used to hand out, three sets deep. */
const OLD: WarmupStep[] = [
  { pct: 0.5, reps: 8 },
  { pct: 0.7, reps: 5 },
  { pct: 0.85, reps: 3 },
]

/**
 * A programme as it sits on a phone that has been running since before the
 * warm-up policy changed: preset shaped, but with ramps on movements deep in
 * the day that would never earn one now.
 */
const storedV4 = (): AppState => {
  const state = freshState()
  return {
    ...state,
    programs: state.programs.map((p) => ({
      ...p,
      days: p.days.map((d) => ({
        ...d,
        exercises: d.exercises.map((t, i) => (i === 0 ? t : { ...t, warmups: OLD })),
      })),
    })),
  }
}

describe('migrateV4: the warm-up rule reaches a programme that predates it', () => {
  it('leaves warm-ups on the first exercise of a day and nowhere else', () => {
    const out = migrateV4(storedV4())
    for (const p of out.programs) {
      for (const d of p.days) {
        d.exercises.forEach((t, i) => {
          if (i > 0) expect(t.warmups, `${d.name}: ${t.exerciseId}`).toEqual([])
        })
      }
    }
  })

  it('gives a barbell opener the four step ramp, not the old three', () => {
    const out = migrateV4(storedV4())
    const push1 = out.programs[0].days.find((d) => d.name === 'Push 1')!
    expect(push1.exercises[0].exerciseId).toBe('barbell-bench-press')
    expect(push1.exercises[0].warmups.map((w) => w.pct)).toEqual([0.5, 0.7, 0.85, 0.9])
  })

  it("keeps the ramp the programme itself prescribes for the Pull day pulldown", () => {
    const out = migrateV4(storedV4())
    const pull1 = out.programs[0].days.find((d) => d.name === 'Pull 1')!
    expect(pull1.exercises[0].exerciseId).toBe('lat-pulldown')
    expect(pull1.exercises[0].warmups.map((w) => w.pct)).toEqual([0.55, 0.7, 0.85])
  })

  it('leaves a day you have edited exactly as it is, warm-ups and all', () => {
    const stored = storedV4()
    const edited: AppState = {
      ...stored,
      programs: stored.programs.map((p, pi) =>
        pi > 0 ? p : {
          ...p,
          days: p.days.map((d) =>
            d.name !== 'Legs 1' ? d : { ...d, exercises: d.exercises.slice(0, 4) }),
        }),
    }
    const out = migrateV4(edited)
    const legs = out.programs[0].days.find((d) => d.name === 'Legs 1')!
    expect(legs.exercises).toHaveLength(4)
    for (let i = 1; i < legs.exercises.length; i++) {
      expect(legs.exercises[i].warmups, legs.exercises[i].exerciseId).toEqual(OLD)
    }
  })

  it('changes nothing the second time it runs', () => {
    const once = migrateV4(storedV4())
    const twice = migrateV4(once)
    expect(twice.programs).toEqual(once.programs)
  })

  it('leaves a programme that is already right untouched', () => {
    const clean = freshState()
    expect(migrateV4(clean).programs).toEqual(clean.programs)
  })

  it('never rewrites a logged session, since history is not a plan', () => {
    const stored = storedV4()
    expect(migrateV4(stored).sessions).toEqual(stored.sessions)
  })

  it('survives hostile input', () => {
    for (const raw of [null, 42, [], {}, 'nope']) {
      const out = migrateV4(raw)
      expect(out.version).toBe(SCHEMA_VERSION)
      expect(out.programs.length).toBeGreaterThan(0)
    }
  })
})
