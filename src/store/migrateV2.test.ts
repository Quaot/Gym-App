import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { migrateV2, decodeV2 } from './migrate'

// A realistic v2 state captured before the v3 schema change: kg settings,
// preset program with warm-up prose in the notes, logged history with a
// warm-up set, a bodyweight exercise, and sleep entries.
const v2 = JSON.parse(readFileSync(`${__dirname}/../../test-fixtures/v2-state.json`, 'utf8'))

describe('migrateV2 on the captured fixture', () => {
  const state = migrateV2(v2)

  it('produces version 3 and keeps every session and sleep entry', () => {
    expect(state.version).toBe(3)
    expect(state.sessions).toHaveLength(v2.sessions.length)
    expect(state.sleep).toHaveLength(v2.sleep.length)
  })

  it('preserves the stored kg unit and weight step', () => {
    expect(state.settings.unit).toBe('kg')
    expect(state.settings.weightStep).toBe(2.5)
  })

  it('seeds warm-up schemes on the heavy preset templates', () => {
    const templates = state.programs.flatMap((p) => p.days.flatMap((d) => d.exercises))
    for (const slug of ['squat', 'deadlift', 'barbell-bench-press']) {
      const t = templates.find((x) => x.exerciseId === slug)
      expect(t, slug).toBeDefined()
      expect(t!.warmups.length, slug).toBeGreaterThanOrEqual(3)
    }
  })

  it('assigns kg increments to the catalog for a kg user', () => {
    expect(state.catalog['squat'].equipment).toBe('barbell')
    expect(state.catalog['squat'].increment).toBe(2.5)
    expect(state.catalog['seated-leg-curl'].increment).toBe(5)
  })

  it('strips the v2 warm-up prose from template notes', () => {
    const templates = state.programs.flatMap((p) => p.days.flatMap((d) => d.exercises))
    for (const t of templates) {
      expect(t.notes, t.exerciseId).not.toMatch(/Ramp|feeders|warm-up sets first/)
    }
  })

  it('leaves logged session data untouched apart from the new default fields', () => {
    // The decoder orders sessions newest first; compare by id.
    for (const original of v2.sessions) {
      const migrated = state.sessions.find((x) => x.id === original.id)!
      const bench = migrated.exercises[0]
      expect(bench.sets.map((s) => [s.weight, s.reps, s.warmup])).toEqual(
        original.exercises[0].sets.map(
          (s: { weight: number | null; reps: number; warmup: boolean }) => [s.weight, s.reps, s.warmup],
        ),
      )
      expect(bench.warmupPlan).toEqual([])
      expect(bench.repCap).toBeGreaterThanOrEqual(bench.repHigh)
    }
  })

  it('is idempotent: migrating the migrated state changes nothing', () => {
    const again = migrateV2(JSON.parse(JSON.stringify(state)))
    expect(again).toEqual(state)
  })

  it('round-trips through the current decoder unchanged', () => {
    expect(decodeV2(JSON.parse(JSON.stringify(state)))).toEqual(state)
  })
})

describe('migrateV2 on hostile input', () => {
  it('handles garbage by falling back to a fresh v3 state', () => {
    for (const raw of [null, 42, 'x', [], {}]) {
      const state = migrateV2(raw)
      expect(state.version).toBe(3)
      expect(state.programs.length).toBeGreaterThan(0)
    }
  })
})
