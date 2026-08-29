import type { AppState } from '../types'
import { decodeAppState } from './decode'
import { resolveExercise } from '../lib/catalog'
import { pplProgram, presetCatalog } from '../lib/presets'
import { uid } from '../lib/util'

export const V1_KEY = 'gym-app:state:v1'

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const presetFallback = () => {
  const program = pplProgram()
  return {
    catalog: presetCatalog(),
    programs: [program],
    activeProgramId: program.id,
  }
}

/**
 * Converts a raw v1 blob (single program; exercises identified by name only;
 * sets without completedAt) into a raw v2 shape, then runs it through the
 * repairing decoder. Never throws.
 */
export const migrateV1 = (raw: unknown): AppState => {
  if (!isObj(raw)) return decodeAppState({}, presetFallback)

  const catalog = presetCatalog()

  // v1 templates carry `name`; v2 templates carry `exerciseId`. Resolve each
  // name into the catalog (preset slugs match by construction; free-typed
  // names are adopted as new entries).
  const withExerciseId = <T extends Record<string, unknown>>(entry: T): T => {
    const name = typeof entry.name === 'string' ? entry.name : ''
    const exercise = resolveExercise(catalog, name || 'Exercise')
    catalog[exercise.id] ??= exercise
    return { ...entry, exerciseId: exercise.id }
  }

  const program = isObj(raw.program)
    ? {
        ...raw.program,
        id: typeof raw.program.id === 'string' ? raw.program.id : uid(),
        presetKey: 'ppl6',
        days: Array.isArray(raw.program.days)
          ? raw.program.days.map((d) =>
              isObj(d)
                ? {
                    ...d,
                    exercises: Array.isArray(d.exercises)
                      ? d.exercises.filter(isObj).map(withExerciseId)
                      : [],
                  }
                : d,
            )
          : [],
      }
    : null

  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.map((s) =>
        isObj(s)
          ? {
              ...s,
              programId: program?.id ?? null,
              exercises: Array.isArray(s.exercises)
                ? s.exercises.filter(isObj).map(withExerciseId)
                : [],
            }
          : s,
      )
    : []

  return decodeAppState(
    {
      catalog,
      programs: program ? [program] : [],
      activeProgramId: program?.id,
      sessions,
      activeSessionId: raw.activeSessionId,
      sleep: [],
      rest: null,
      settings: raw.settings,
    },
    presetFallback,
  )
}

/** Decodes a raw v2 payload (already keyed by slice or whole). */
export const decodeV2 = (raw: unknown): AppState =>
  decodeAppState(raw, presetFallback)

export const freshState = (): AppState => decodeAppState({}, presetFallback)
