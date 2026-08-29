import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../types'
import { decodeAppState, decodeRest } from './decode'
import { freshState } from './migrate'
import { pplProgram, presetCatalog } from '../lib/presets'

const fallback = () => {
  const program = pplProgram()
  return { catalog: presetCatalog(), programs: [program], activeProgramId: program.id }
}

const decode = (raw: unknown) => decodeAppState(raw, fallback)

describe('decodeAppState never throws', () => {
  const hostile: unknown[] = [
    null,
    undefined,
    0,
    'string',
    [],
    {},
    { sessions: [{}] },
    { sessions: 'not-an-array' },
    { programs: [null, 42, { days: [null, { exercises: [null, {}, { exerciseId: 7 }] }] }] },
    { catalog: { x: null, y: 5, z: { id: 'z' } } },
    { settings: { unit: 'stone', defaultRestSec: 'later', weightStep: -3 } },
    { sleep: [{ night: 'not-a-date', asleepMin: 480 }, { night: '2026-01-05', asleepMin: -5 }] },
    { activeSessionId: 'nowhere' },
    { rest: { endsAt: 'soon' } },
  ]

  it.each(hostile.map((h, i) => [i, h] as const))('case %i decodes to a valid state', (_, raw) => {
    const state = decode(raw)
    expect(state.version).toBe(SCHEMA_VERSION)
    expect(state.programs.length).toBeGreaterThan(0)
    expect(state.programs.some((p) => p.id === state.activeProgramId)).toBe(true)
    expect(Array.isArray(state.sessions)).toBe(true)
    expect(Array.isArray(state.sleep)).toBe(true)
  })
})

describe('repair, not reject', () => {
  it('drops malformed sessions while intact siblings survive', () => {
    const good = {
      id: 's1',
      startedAt: 1000,
      finishedAt: 2000,
      dayName: 'Push',
      exercises: [
        {
          id: 'e1',
          exerciseId: 'barbell-bench-press',
          name: 'Barbell Bench Press',
          repLow: 5,
          repHigh: 8,
          restSec: 120,
          notes: '',
          sets: [{ id: 'x1', weight: 60, reps: 5, done: true, warmup: false, completedAt: 1500 }],
        },
      ],
      notes: '',
    }
    const state = decode({ sessions: [null, {}, { startedAt: 'yes' }, good, 'junk'] })
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0].id).toBe('s1')
    expect(state.sessions[0].exercises[0].sets[0].weight).toBe(60)
  })

  it('drops malformed sets and exercises inside a kept session', () => {
    const state = decode({
      sessions: [
        {
          id: 's1',
          startedAt: 1,
          exercises: [
            null,
            { name: '' },
            {
              id: 'e1',
              exerciseId: 'x',
              name: 'Row',
              sets: [null, 'bad', { id: 'ok', weight: 40, reps: 10, done: true }],
            },
          ],
        },
      ],
    })
    expect(state.sessions[0].exercises).toHaveLength(1)
    expect(state.sessions[0].exercises[0].sets).toHaveLength(1)
  })

  it('repairs the done-without-reps invariant by un-completing the set', () => {
    const state = decode({
      sessions: [
        {
          id: 's1',
          startedAt: 1,
          exercises: [
            {
              id: 'e1',
              exerciseId: 'x',
              name: 'Row',
              sets: [{ id: 'a', weight: 40, reps: null, done: true }],
            },
          ],
        },
      ],
    })
    expect(state.sessions[0].exercises[0].sets[0].done).toBe(false)
  })

  it('clears an activeSessionId that points nowhere or at a finished session', () => {
    expect(decode({ activeSessionId: 'ghost' }).activeSessionId).toBeNull()
    const state = decode({
      activeSessionId: 's1',
      sessions: [{ id: 's1', startedAt: 1, finishedAt: 2, exercises: [] }],
    })
    expect(state.activeSessionId).toBeNull()
  })

  it('adopts stray exerciseIds into the catalog so history never dangles', () => {
    const state = decode({
      sessions: [
        {
          id: 's1',
          startedAt: 1,
          exercises: [{ id: 'e1', exerciseId: 'missing-id', name: 'Mystery Lift', sets: [] }],
        },
      ],
    })
    const e = state.sessions[0].exercises[0]
    expect(state.catalog[e.exerciseId]).toBeDefined()
    expect(state.catalog[e.exerciseId].name).toBe('Mystery Lift')
  })

  it('ignores unknown extra keys', () => {
    const state = decode({ hacker: true, __proto__: { evil: 1 }, settings: { unit: 'lb', extra: 9 } })
    expect(state.settings.unit).toBe('lb')
    expect((state as unknown as Record<string, unknown>).hacker).toBeUndefined()
  })
})

describe('round-trip stability', () => {
  it('decode(JSON round-trip of a fresh state) is deep-equal', () => {
    const state = freshState()
    expect(decode(JSON.parse(JSON.stringify(state)))).toEqual(state)
  })
})

describe('decodeRest', () => {
  it('accepts a valid rest and rejects broken ones', () => {
    expect(decodeRest({ endsAt: 5, totalSec: 90, exerciseName: 'Row' })).toEqual({
      endsAt: 5,
      totalSec: 90,
      exerciseName: 'Row',
    })
    expect(decodeRest(null)).toBeNull()
    expect(decodeRest({ endsAt: 'x', totalSec: 90 })).toBeNull()
    expect(decodeRest({ endsAt: 5, totalSec: 0 })).toBeNull()
  })
})
