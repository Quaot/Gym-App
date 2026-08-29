import type { AppState } from '../types'
import { initialState, SCHEMA_VERSION } from './defaults'

const KEY = 'gym-app:state:v1'

/** Fills in anything a older/partial payload is missing so a bad or truncated
 *  value can never blank the app on launch. */
const hydrate = (raw: unknown): AppState => {
  const base = initialState()
  if (!raw || typeof raw !== 'object') return base
  const s = raw as Partial<AppState>
  return {
    version: SCHEMA_VERSION,
    program: s.program?.days ? s.program : base.program,
    sessions: Array.isArray(s.sessions) ? s.sessions : [],
    activeSessionId: s.activeSessionId ?? null,
    settings: { ...base.settings, ...(s.settings ?? {}) },
  }
}

export const load = (): AppState => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? hydrate(JSON.parse(raw)) : initialState()
  } catch {
    return initialState()
  }
}

export const save = (state: AppState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Private mode / quota: the session still works in memory.
  }
}

export const exportJSON = (state: AppState) => JSON.stringify(state, null, 2)

export const importJSON = (text: string): AppState => hydrate(JSON.parse(text))
