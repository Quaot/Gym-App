// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStore } from './store'
import { SCHEMA_VERSION } from '../types'
import {
  attachPersistence, isStorageHealthy, KEYS, loadInitialState, persistAll,
} from './persist'
import { V1_KEY } from './migrate'
import { freshState } from './migrate'
import { readFileSync } from 'node:fs'

const v1Raw = readFileSync(`${__dirname}/../../test-fixtures/v1-state.json`, 'utf8')

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('loadInitialState', () => {
  it('boots fresh with nothing stored', () => {
    const state = loadInitialState()
    expect(state.version).toBe(SCHEMA_VERSION)
    expect(state.sessions).toEqual([])
  })

  it('migrates a v1 blob, writes v2 keys, and removes the old key', () => {
    localStorage.setItem(V1_KEY, v1Raw)
    const state = loadInitialState()
    expect(state.sessions.length).toBeGreaterThan(0)
    expect(localStorage.getItem(V1_KEY)).toBeNull()
    expect(localStorage.getItem(KEYS.core)).not.toBeNull()
    expect(localStorage.getItem(KEYS.sessions)).not.toBeNull()
    // Second boot reads the v2 keys and reproduces the same state.
    expect(loadInitialState()).toEqual(state)
  })

  it('survives corrupted slices by falling back per-slice or fresh', () => {
    localStorage.setItem(KEYS.core, '{"version":2,"progr') // truncated write
    const state = loadInitialState()
    expect(state.version).toBe(SCHEMA_VERSION)
    expect(state.programs.length).toBeGreaterThan(0)
  })

  it('round-trips a full state through persistAll', () => {
    const state = freshState()
    persistAll(state)
    expect(loadInitialState()).toEqual(state)
  })
})

describe('attachPersistence', () => {
  it('debounces bulk writes: many dispatches, one write', () => {
    const store = new AppStore(loadInitialState())
    const detach = attachPersistence(store)
    const spy = vi.spyOn(localStorage, 'setItem')

    for (let i = 0; i < 25; i++) {
      store.dispatch({ type: 'setSettings', patch: { defaultRestSec: 100 + i } })
    }
    expect(spy.mock.calls.filter(([k]) => k === KEYS.core)).toHaveLength(0)
    vi.advanceTimersByTime(600)
    expect(spy.mock.calls.filter(([k]) => k === KEYS.core)).toHaveLength(1)

    detach()
    spy.mockRestore()
  })

  it('writes the rest slice synchronously', () => {
    const store = new AppStore(loadInitialState())
    const detach = attachPersistence(store)
    store.dispatch({
      type: 'startRest',
      rest: { endsAt: Date.now() + 90_000, totalSec: 90, exerciseName: 'Row' },
    })
    // No timer advance: it must already be on disk.
    expect(JSON.parse(localStorage.getItem(KEYS.rest)!)).toMatchObject({ totalSec: 90 })
    detach()
  })

  it('flushes pending writes on detach (stands in for pagehide)', () => {
    const store = new AppStore(loadInitialState())
    const detach = attachPersistence(store)
    store.dispatch({ type: 'setSettings', patch: { weightStep: 5 } })
    detach() // no timer advance
    const core = JSON.parse(localStorage.getItem(KEYS.core)!)
    expect(core.settings.weightStep).toBe(5)
  })

  it('surfaces quota errors through the storage-health flag (bug 20)', () => {
    const store = new AppStore(loadInitialState())
    const detach = attachPersistence(store)
    expect(isStorageHealthy()).toBe(true)
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    store.dispatch({ type: 'setSettings', patch: { weightStep: 10 } })
    vi.advanceTimersByTime(600)
    expect(isStorageHealthy()).toBe(false)
    spy.mockRestore()
    // A later successful write clears the flag.
    store.dispatch({ type: 'setSettings', patch: { weightStep: 2.5 } })
    vi.advanceTimersByTime(600)
    expect(isStorageHealthy()).toBe(true)
    detach()
  })
})

describe('the v3 to v4 upgrade on real storage', () => {
  it('boots a stored v3 profile into ten days and retires the old keys', () => {
    const fresh = freshState()
    const six = fresh.programs[0].days.filter((d) =>
      ['Push 1', 'Pull 1', 'Legs 1', 'Push 2', 'Pull 2', 'Legs 2'].includes(d.name),
    )
    localStorage.setItem('gym:v3:core', JSON.stringify({
      version: 3,
      catalog: fresh.catalog,
      programs: [{ ...fresh.programs[0], days: six }],
      activeProgramId: fresh.programs[0].id,
      activeSessionId: null,
      settings: fresh.settings,
    }))
    localStorage.setItem('gym:v3:sessions', JSON.stringify([]))

    const state = loadInitialState()
    expect(state.programs[0].days).toHaveLength(10)
    expect(state.version).toBe(SCHEMA_VERSION)
    expect(localStorage.getItem('gym:v3:core')).toBeNull()
    expect(localStorage.getItem(KEYS.core)).not.toBeNull()

    // Second boot reads v4 and must not insert the days again.
    expect(loadInitialState().programs[0].days).toHaveLength(10)
  })

  it('leaves an edited v3 program at six days and still retires the keys', () => {
    const fresh = freshState()
    const six = fresh.programs[0].days
      .filter((d) => ['Push 1', 'Pull 1', 'Legs 1', 'Push 2', 'Pull 2', 'Legs 2'].includes(d.name))
      .map((d, i) => (i === 0 ? { ...d, name: 'Chest Day' } : d))
    localStorage.setItem('gym:v3:core', JSON.stringify({
      version: 3,
      catalog: fresh.catalog,
      programs: [{ ...fresh.programs[0], days: six }],
      activeProgramId: fresh.programs[0].id,
      activeSessionId: null,
      settings: fresh.settings,
    }))

    const state = loadInitialState()
    expect(state.programs[0].days).toHaveLength(6)
    expect(state.programs[0].days[0].name).toBe('Chest Day')
    expect(localStorage.getItem('gym:v3:core')).toBeNull()
  })
})
