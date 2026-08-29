import type { AppState, Unit } from '../types'
import { decodeAppState } from './decode'
import { resolveExercise } from '../lib/catalog'
import { pplProgram, presetCatalog, presetTemplateMeta, setPresetUnit } from '../lib/presets'
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

/** Decodes a raw current-version payload (already keyed by slice or whole). */
export const decodeV2 = (raw: unknown): AppState =>
  decodeAppState(raw, presetFallback)

/** Warm-up prose the v2 presets emitted; migration strips exactly these. */
const V2_WARMUP_PROSE = [
  /Ramp up in warm-up sets, then take one heavy top set of 3-5 reps\.\s*/,
  /Ramp first: [^.]*\.\s*/,
  /Three warm-up sets first: [^.]*\.\s*/,
  /Pyramid warm-up: [^.]*\.\s*/,
  /Sets 1-4 are feeders[^.]*\.\s*/,
  /Tap a set number to mark the feeders as warm-ups\.\s*/,
]

/**
 * v2 -> v3: same shape plus equipment, increment, warmups, repCap. The
 * decoders supply defaults; known preset exercises get their real schemes
 * from the preset meta table, and v2 warm-up prose leaves the notes.
 * Idempotent: warmups are only filled where empty.
 */
export const migrateV2 = (raw: unknown): AppState => {
  const state = decodeAppState(raw, presetFallback)
  const unit: Unit = state.settings.unit
  const meta = presetTemplateMeta(unit)

  const catalog = { ...state.catalog }
  for (const [slug, m] of Object.entries(meta)) {
    const existing = catalog[slug]
    if (existing) {
      catalog[slug] = { ...existing, equipment: m.equipment, increment: m.increment }
    }
  }

  const stripProse = (notes: string): string => {
    let out = notes
    for (const re of V2_WARMUP_PROSE) out = out.replace(re, '')
    return out.trim()
  }

  const programs = state.programs.map((p) => ({
    ...p,
    days: p.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((t) => {
        const m = meta[t.exerciseId]
        return {
          ...t,
          warmups: t.warmups.length > 0 ? t.warmups : (m?.warmups ?? []),
          repCap: Math.max(t.repCap, t.repHigh + (m?.extend ?? 0)),
          notes: stripProse(t.notes),
        }
      }),
    })),
  }))

  return { ...state, catalog, programs }
}

export const freshState = (): AppState => {
  setPresetUnit('lb')
  return decodeAppState({}, presetFallback)
}
