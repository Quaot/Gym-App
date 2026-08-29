import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../types'
import { migrateV1, migrateV3, decodeV2, freshState } from './migrate'
import { slugify } from '../lib/catalog'

// A real v1 state captured from the running v1 app: 5 sessions of which 2 are
// unfinished (one orphaned by the start-while-active bug, one active), preset
// program, real logged sets including a bodyweight-style null-weight set.
const v1 = JSON.parse(readFileSync(`${__dirname}/../../test-fixtures/v1-state.json`, 'utf8'))

describe('migrateV1 on the captured fixture', () => {
  const state = migrateV1(v1)

  it('produces the current schema version', () => {
    expect(state.version).toBe(SCHEMA_VERSION)
  })

  it('keeps every v1 session', () => {
    expect(state.sessions).toHaveLength(v1.sessions.length)
  })

  it('gives every session exercise a valid exerciseId resolving into the catalog', () => {
    for (const s of state.sessions) {
      for (const e of s.exercises) {
        expect(e.exerciseId, e.name).toBeTruthy()
        expect(state.catalog[e.exerciseId], e.name).toBeDefined()
        expect(state.catalog[e.exerciseId].name.toLowerCase()).toBe(e.name.toLowerCase())
      }
    }
  })

  it('maps same-named exercises across sessions onto one catalog entry', () => {
    const ids = new Map<string, string>()
    for (const s of state.sessions) {
      for (const e of s.exercises) {
        const key = e.name.trim().toLowerCase()
        const seen = ids.get(key)
        if (seen) expect(e.exerciseId, e.name).toBe(seen)
        else ids.set(key, e.exerciseId)
      }
    }
  })

  it('maps preset exercise names to preset slugs so history keys line up', () => {
    const bench = state.sessions
      .flatMap((s) => s.exercises)
      .find((e) => e.name === 'Barbell Bench Press')
    expect(bench).toBeDefined()
    expect(bench!.exerciseId).toBe(slugify('Barbell Bench Press'))
  })

  it('keeps program templates and rewrites them onto exerciseId', () => {
    const program = state.programs[0]
    expect(program.days.length).toBeGreaterThan(0)
    for (const d of program.days) {
      for (const t of d.exercises) {
        expect(state.catalog[t.exerciseId], d.name).toBeDefined()
      }
    }
  })

  it('keeps the orphaned unfinished sessions so they can be resumed', () => {
    const unfinished = state.sessions.filter((s) => s.finishedAt === null)
    expect(unfinished.length).toBe(
      (v1.sessions as { finishedAt: number | null }[]).filter((s) => s.finishedAt === null).length,
    )
  })

  it('keeps a valid activeSessionId when v1 had one', () => {
    expect(state.activeSessionId).toBe(v1.activeSessionId)
    const active = state.sessions.find((s) => s.id === state.activeSessionId)
    expect(active).toBeDefined()
    expect(active!.finishedAt).toBeNull()
  })

  it('adds completedAt: null to migrated sets and preserves values', () => {
    const finished = state.sessions.filter((s) => s.finishedAt !== null)
    expect(finished.length).toBeGreaterThan(0)
    let checked = 0
    for (const s of finished) {
      for (const e of s.exercises) {
        for (const set of e.sets) {
          expect(set.completedAt).toBeNull()
          expect(set.done).toBe(true)
          expect(set.reps).not.toBeNull()
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(5)
  })

  it('preserves settings and flags the program as the ppl6 preset', () => {
    expect(state.settings.unit).toBe(v1.settings.unit)
    expect(state.settings.defaultRestSec).toBe(v1.settings.defaultRestSec)
    expect(state.programs[0].presetKey).toBe('ppl6')
  })

  it('starts with empty sleep and no rest timer', () => {
    expect(state.sleep).toEqual([])
    expect(state.rest).toBeNull()
  })

  it('is idempotent: re-decoding the migrated state changes nothing', () => {
    const again = decodeV2(JSON.parse(JSON.stringify(state)))
    expect(again).toEqual(state)
  })
})

describe('migrateV1 on hostile input', () => {
  it('handles null, garbage, and empty objects by falling back to a fresh state', () => {
    for (const raw of [null, undefined, 42, 'hi', [], {}]) {
      const state = migrateV1(raw)
      expect(state.version).toBe(SCHEMA_VERSION)
      expect(state.programs.length).toBeGreaterThan(0)
      expect(state.sessions).toEqual([])
    }
  })

  it('drops malformed sessions but keeps intact ones', () => {
    const state = migrateV1({
      ...v1,
      sessions: [null, {}, 'bad', ...v1.sessions],
    })
    expect(state.sessions).toHaveLength(v1.sessions.length)
  })
})

describe('freshState', () => {
  it('boots with the ppl6 preset and a fully-resolvable catalog', () => {
    const state = freshState()
    expect(state.programs[0].days).toHaveLength(10)
    for (const d of state.programs[0].days) {
      for (const t of d.exercises) {
        expect(state.catalog[t.exerciseId]).toBeDefined()
      }
    }
  })
})

describe('migrateV3: the six day rotation becomes ten', () => {
  /** A stored v3 core, shaped exactly as the six day preset shipped it. */
  const storedV3 = () => {
    const fresh = freshState()
    const preset = fresh.programs[0]
    const six = preset.days.filter((d) =>
      ['Push 1', 'Pull 1', 'Legs 1', 'Push 2', 'Pull 2', 'Legs 2'].includes(d.name),
    )
    return {
      ...fresh,
      programs: [{ ...preset, days: six }],
    }
  }

  it('adds the four days in position and leaves the rotation in order', () => {
    const out = migrateV3(storedV3())
    expect(out.programs[0].days.map((d) => d.name)).toEqual([
      'Push 1', 'Pull 1', 'Legs 1', 'Upper 1', 'Lower 1',
      'Push 2', 'Pull 2', 'Legs 2', 'Upper 2', 'Lower 2',
    ])
  })

  it('keeps every original day, by id', () => {
    const before = storedV3()
    const ids = before.programs[0].days.map((d) => d.id)
    const after = migrateV3(before)
    for (const id of ids) {
      expect(after.programs[0].days.some((d) => d.id === id), id).toBe(true)
    }
  })

  it('changes nothing on a second run', () => {
    const once = migrateV3(storedV3())
    expect(migrateV3(once).programs[0].days.map((d) => d.name))
      .toEqual(once.programs[0].days.map((d) => d.name))
  })

  it('leaves a renamed day alone: those days are yours, not the preset\'s', () => {
    const state = storedV3()
    state.programs[0].days[2] = { ...state.programs[0].days[2], name: 'Leg Day' }
    expect(migrateV3(state).programs[0].days).toHaveLength(6)
  })

  it('leaves a program alone once an exercise has been removed', () => {
    const state = storedV3()
    const day = state.programs[0].days[0]
    state.programs[0].days[0] = { ...day, exercises: day.exercises.slice(1) }
    expect(migrateV3(state).programs[0].days).toHaveLength(6)
  })

  it('leaves the five day split and a custom program alone', () => {
    const state = storedV3()
    state.programs[0] = { ...state.programs[0], presetKey: 'pplul5' }
    expect(migrateV3(state).programs[0].days).toHaveLength(6)
    const custom = storedV3()
    custom.programs[0] = { ...custom.programs[0], presetKey: null }
    expect(migrateV3(custom).programs[0].days).toHaveLength(6)
  })

  it('leaves rep and rest edits in place, since those are ordinary use', () => {
    const state = storedV3()
    const day = state.programs[0].days[0]
    state.programs[0].days[0] = {
      ...day,
      exercises: [{ ...day.exercises[0], repHigh: 12, restSec: 60 }, ...day.exercises.slice(1)],
    }
    const out = migrateV3(state)
    expect(out.programs[0].days).toHaveLength(10)
    expect(out.programs[0].days[0].exercises[0].repHigh).toBe(12)
  })

  it('carries sessions, sleep and settings through untouched', () => {
    const state = storedV3()
    const withData = {
      ...state,
      settings: { ...state.settings, unit: 'kg' as const, bodyweight: 82 },
      sleep: [{ id: 's1', night: '2026-01-02', asleepMin: 400, inBedMin: 430, source: 'manual' as const }],
    }
    const out = migrateV3(withData)
    expect(out.settings.unit).toBe('kg')
    expect(out.settings.bodyweight).toBe(82)
    expect(out.sleep).toHaveLength(1)
  })

  it('back-fills any movement the stored catalog is missing', () => {
    const state = storedV3()
    // A user who never trained a Kroc Row may not carry it in their catalog.
    const thinned = { ...state.catalog }
    delete thinned['kroc-row']
    const out = migrateV3({ ...state, catalog: thinned })
    for (const d of out.programs[0].days) {
      for (const t of d.exercises) expect(out.catalog[t.exerciseId], t.exerciseId).toBeDefined()
    }
  })

  it('survives hostile input', () => {
    for (const raw of [null, 42, [], {}, 'nope']) {
      const out = migrateV3(raw)
      expect(out.version).toBe(SCHEMA_VERSION)
      expect(out.programs.length).toBeGreaterThan(0)
    }
  })
})
