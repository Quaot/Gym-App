import type { AppState, DayTemplate, Program, Unit, WarmupStep } from '../types'
import { decodeAppState } from './decode'
import { resolveExercise } from '../lib/catalog'
import {
  pplProgram, pplulProgram, presetCatalog, presetTemplateMeta, setPresetUnit,
} from '../lib/presets'
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

/* ------------------------------------------------------------------ *
 * v3 -> v4: the six day rotation becomes ten.
 * ------------------------------------------------------------------ */

const PPL6_DAYS = ['Push 1', 'Pull 1', 'Legs 1', 'Push 2', 'Pull 2', 'Legs 2']
/** Upper 1 and Lower 1 land after Legs 1; the other two close the rotation. */
const ADDED_MID = ['Upper 1', 'Lower 1']
const ADDED_END = ['Upper 2', 'Lower 2']

/**
 * True only for a stored program still shaped the way the six day preset
 * shipped it: the same days, in order, each holding the same movements in the
 * same order. Changing a rep range or a rest is ordinary use and does not
 * disqualify a program; adding, removing, reordering or renaming does, because
 * then the days are yours and not the preset's to extend.
 */
const isUntouchedPpl6 = (p: Program, preset: Program): boolean => {
  if (p.presetKey !== 'ppl6' || p.days.length !== PPL6_DAYS.length) return false
  return p.days.every((d, i) => {
    if (d.name !== PPL6_DAYS[i]) return false
    const want = preset.days.find((x) => x.name === d.name)
    if (!want) return false
    const mine = d.exercises.map((t) => t.exerciseId)
    const theirs = want.exercises.map((t) => t.exerciseId)
    return mine.length === theirs.length && mine.every((id, j) => id === theirs[j])
  })
}

/**
 * Adds the four new days to a program that still matches the preset, and
 * leaves every other program exactly as it is. Running twice changes nothing,
 * since a program that already has ten days no longer matches.
 */
export const migrateV3 = (raw: unknown): AppState => {
  const state = decodeV2(raw)
  const preset = pplProgram()
  if (!state.programs.some((p) => isUntouchedPpl6(p, preset))) return state

  const full = presetCatalog(state.settings.unit)
  const catalog = { ...state.catalog }
  const take = (name: string): DayTemplate => {
    const d = preset.days.find((x) => x.name === name)!
    // Adopt any movement this catalog is missing, or the decoder would drop
    // the template on the next read.
    for (const t of d.exercises) catalog[t.exerciseId] ??= full[t.exerciseId]
    return d
  }

  const programs = state.programs.map((p) => {
    if (!isUntouchedPpl6(p, preset)) return p
    const days = [...p.days]
    days.splice(3, 0, ...ADDED_MID.map(take))
    days.push(...ADDED_END.map(take))
    return { ...p, days }
  })

  return { ...state, catalog, programs }
}

/* ------------------------------------------------------------------ *
 * v4 -> v5: the warm-up rule reaches programs that already existed.
 * ------------------------------------------------------------------ */

/** True when a stored day still holds the preset's movements, in its order. */
const sameMovements = (mine: DayTemplate, theirs: DayTemplate): boolean =>
  mine.exercises.length === theirs.exercises.length &&
  mine.exercises.every((t, i) => t.exerciseId === theirs.exercises[i].exerciseId)

/** The preset day a stored day still is, or null once you have edited it. */
const presetDayFor = (presets: Program[], day: DayTemplate): DayTemplate | null => {
  for (const p of presets) {
    const want = p.days.find((d) => d.name === day.name)
    if (want && sameMovements(day, want)) return want
  }
  return null
}

const sameWarmups = (a: WarmupStep[], b: WarmupStep[]): boolean =>
  a.length === b.length && a.every((w, i) => w.pct === b[i].pct && w.reps === b[i].reps)

/**
 * Applies today's warm-up prescription to a program that predates it.
 *
 * The rule: the first exercise of a day gets a four step ramp at 50, 70, 85
 * and 90 percent of the weight you are about to lift, and only when it loads
 * a barbell. Nothing else in the day gets warm-up rows.
 *
 * The preset has said that since the policy changed, but a program built
 * before it kept whatever the old per-role schemes handed out, and migrateV2
 * fills warm-ups only where they are empty, so nothing ever took them away.
 * This does, for any day still shaped exactly the way a preset shipped it.
 * A day you have edited is yours, and is left alone, warm-ups and all.
 *
 * Idempotent: a day already carrying the preset's warm-ups is returned as is.
 */
export const migrateV4 = (raw: unknown): AppState => {
  const state = decodeV2(raw)
  const presets = [pplProgram(), pplulProgram()]

  const programs = state.programs.map((p) => ({
    ...p,
    days: p.days.map((d) => {
      const want = presetDayFor(presets, d)
      if (!want) return d
      return {
        ...d,
        exercises: d.exercises.map((t, i) =>
          sameWarmups(t.warmups, want.exercises[i].warmups)
            ? t
            : { ...t, warmups: want.exercises[i].warmups }),
      }
    }),
  }))

  return { ...state, programs }
}

export const freshState = (): AppState => {
  setPresetUnit('lb')
  return decodeAppState({}, presetFallback)
}
