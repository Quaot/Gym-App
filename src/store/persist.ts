import type { AppState } from '../types'
import type { AppStore } from './store'
import {
  decodeV2, freshState, migrateV1, migrateV2, migrateV3, migrateV4, V1_KEY,
} from './migrate'

export const KEYS = {
  core: 'gym:v5:core', // catalog, programs, settings, activeProgramId, activeSessionId
  sessions: 'gym:v5:sessions',
  sleep: 'gym:v5:sleep',
  rest: 'gym:v5:rest',
} as const

const V4_KEYS = {
  core: 'gym:v4:core',
  sessions: 'gym:v4:sessions',
  sleep: 'gym:v4:sleep',
  rest: 'gym:v4:rest',
} as const

const V3_KEYS = {
  core: 'gym:v3:core',
  sessions: 'gym:v3:sessions',
  sleep: 'gym:v3:sleep',
  rest: 'gym:v3:rest',
} as const

const V2_KEYS = {
  core: 'gym:v2:core',
  sessions: 'gym:v2:sessions',
  sleep: 'gym:v2:sleep',
  rest: 'gym:v2:rest',
} as const

const DEBOUNCE_MS = 500

/* ------------------------------------------------------------------ *
 * Storage-health flag: quota failures must be visible, not swallowed.
 * ------------------------------------------------------------------ */
let healthy = true
const healthListeners = new Set<() => void>()
export const isStorageHealthy = () => healthy
export const subscribeStorageHealth = (fn: () => void): (() => void) => {
  healthListeners.add(fn)
  return () => healthListeners.delete(fn)
}
const setHealthy = (v: boolean) => {
  if (healthy === v) return
  healthy = v
  for (const fn of healthListeners) fn()
}

const write = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    setHealthy(true)
  } catch {
    setHealthy(false)
  }
}

const readJSON = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

const retire = (keys: string[]) => {
  for (const key of keys) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* removal is best-effort */
    }
  }
}

/** Loads state: v5 slices, else v4, v3, v2 or a v1 blob migrated, else fresh. */
export const loadInitialState = (): AppState => {
  try {
    const core = readJSON(KEYS.core)
    if (core !== null && typeof core === 'object') {
      return decodeV2({
        ...(core as Record<string, unknown>),
        sessions: readJSON(KEYS.sessions) ?? [],
        sleep: readJSON(KEYS.sleep) ?? [],
        rest: readJSON(KEYS.rest),
      })
    }

    const v4core = readJSON(V4_KEYS.core)
    if (v4core !== null && typeof v4core === 'object') {
      const migrated = migrateV4({
        ...(v4core as Record<string, unknown>),
        sessions: readJSON(V4_KEYS.sessions) ?? [],
        sleep: readJSON(V4_KEYS.sleep) ?? [],
        rest: readJSON(V4_KEYS.rest),
      })
      persistAll(migrated)
      retire(Object.values(V4_KEYS))
      return migrated
    }

    const v3core = readJSON(V3_KEYS.core)
    if (v3core !== null && typeof v3core === 'object') {
      const migrated = migrateV4(migrateV3({
        ...(v3core as Record<string, unknown>),
        sessions: readJSON(V3_KEYS.sessions) ?? [],
        sleep: readJSON(V3_KEYS.sleep) ?? [],
        rest: readJSON(V3_KEYS.rest),
      }))
      persistAll(migrated)
      retire(Object.values(V3_KEYS))
      return migrated
    }

    const v2core = readJSON(V2_KEYS.core)
    if (v2core !== null && typeof v2core === 'object') {
      const migrated = migrateV4(migrateV3(migrateV2({
        ...(v2core as Record<string, unknown>),
        sessions: readJSON(V2_KEYS.sessions) ?? [],
        sleep: readJSON(V2_KEYS.sleep) ?? [],
        rest: readJSON(V2_KEYS.rest),
      })))
      persistAll(migrated)
      retire(Object.values(V2_KEYS))
      return migrated
    }

    const v1 = readJSON(V1_KEY)
    if (v1 !== null) {
      const migrated = migrateV4(migrateV3(migrateV2(migrateV1(v1))))
      persistAll(migrated)
      retire([V1_KEY])
      return migrated
    }
  } catch {
    /* fall through to fresh */
  }
  const fresh = freshState()
  persistAll(fresh)
  return fresh
}

const coreOf = (s: AppState) => ({
  version: s.version,
  catalog: s.catalog,
  programs: s.programs,
  activeProgramId: s.activeProgramId,
  activeSessionId: s.activeSessionId,
  settings: s.settings,
})

export const persistAll = (s: AppState): void => {
  write(KEYS.core, coreOf(s))
  write(KEYS.sessions, s.sessions)
  write(KEYS.sleep, s.sleep)
  write(KEYS.rest, s.rest)
}

/**
 * Watches the store and writes only the slices whose references changed.
 * Small, must-survive-reload slices (rest, activeSessionId) write
 * synchronously; the bulky arrays debounce and flush on hide/pagehide.
 */
export const attachPersistence = (store: AppStore): (() => void) => {
  let prev = store.getState()
  let dirty = { core: false, sessions: false, sleep: false }
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    const s = store.getState()
    if (dirty.core) write(KEYS.core, coreOf(s))
    if (dirty.sessions) write(KEYS.sessions, s.sessions)
    if (dirty.sleep) write(KEYS.sleep, s.sleep)
    dirty = { core: false, sessions: false, sleep: false }
  }

  const schedule = () => {
    if (timer === null) timer = setTimeout(flush, DEBOUNCE_MS)
  }

  const unsubscribe = store.subscribe(() => {
    const s = store.getState()

    // Instant writes: tiny payloads that a sudden reload must not lose.
    if (s.rest !== prev.rest) write(KEYS.rest, s.rest)
    const activeChanged = s.activeSessionId !== prev.activeSessionId

    if (
      activeChanged ||
      s.catalog !== prev.catalog ||
      s.programs !== prev.programs ||
      s.settings !== prev.settings ||
      s.activeProgramId !== prev.activeProgramId
    ) {
      dirty.core = true
    }
    if (s.sessions !== prev.sessions) dirty.sessions = true
    if (s.sleep !== prev.sleep) dirty.sleep = true

    prev = s
    if (activeChanged) flush()
    else if (dirty.core || dirty.sessions || dirty.sleep) schedule()
  })

  const onHide = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', flush)

  return () => {
    flush()
    unsubscribe()
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', flush)
  }
}
