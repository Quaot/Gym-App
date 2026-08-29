import type {
  AppState, DayTemplate, Equipment, Exercise, ExerciseTemplate, LoggedSet,
  Program, RestState, Session, SessionExercise, Settings, SleepEntry,
  WarmupStep,
} from '../types'
import { SCHEMA_VERSION } from '../types'
import { defaultIncrement, makeExercise } from '../lib/catalog'

/**
 * Repairing decoders: given unknown data (an imported backup, a hand-edited
 * localStorage value, a truncated write), produce a valid AppState without
 * ever throwing. Malformed entries are dropped individually; malformed fields
 * fall back to defaults; the rest of the data survives.
 */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const str = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v : fallback

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback

const idOf = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null

/** Decodes each element, silently dropping the ones that fail. */
const arrOf = <T>(v: unknown, decode: (item: unknown) => T | null): T[] => {
  if (!Array.isArray(v)) return []
  const out: T[] = []
  for (const item of v) {
    const decoded = decode(item)
    if (decoded !== null) out.push(decoded)
  }
  return out
}

let fallbackCounter = 0
const fallbackId = () => `repaired-${Date.now().toString(36)}-${fallbackCounter++}`

const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight']

const decodeExercise = (v: unknown): Exercise | null => {
  if (!isObj(v)) return null
  const id = idOf(v.id)
  const name = str(v.name, '').trim()
  if (!id || !name) return null
  const bodyweight = bool(v.bodyweight, false)
  const equipment = EQUIPMENT.includes(v.equipment as Equipment)
    ? (v.equipment as Equipment)
    : bodyweight
      ? 'bodyweight'
      : 'machine'
  const increment = num(v.increment, defaultIncrement(equipment, 'lb'))
  return {
    id,
    name,
    bodyweight,
    equipment,
    increment: increment > 0 ? increment : defaultIncrement(equipment, 'lb'),
    archived: bool(v.archived, false),
  }
}

const decodeWarmup = (v: unknown): WarmupStep | null => {
  if (!isObj(v)) return null
  const pct = numOrNull(v.pct)
  const reps = numOrNull(v.reps)
  if (pct === null || reps === null) return null
  if (pct < 0.1 || pct > 1 || reps < 1) return null
  return { pct, reps: Math.round(reps) }
}

const decodeTemplate = (v: unknown): ExerciseTemplate | null => {
  if (!isObj(v)) return null
  const exerciseId = idOf(v.exerciseId)
  if (!exerciseId) return null
  const repLow = Math.max(1, Math.round(num(v.repLow, 8)))
  const repHigh = Math.max(repLow, Math.round(num(v.repHigh, repLow)))
  return {
    id: idOf(v.id) ?? fallbackId(),
    exerciseId,
    sets: Math.max(1, Math.round(num(v.sets, 3))),
    repLow,
    repHigh,
    repCap: Math.max(repHigh, Math.round(num(v.repCap, repHigh + 5))),
    restSec: Math.max(0, Math.round(num(v.restSec, 120))),
    warmups: arrOf(v.warmups, decodeWarmup),
    notes: str(v.notes, ''),
  }
}

const decodeDay = (v: unknown): DayTemplate | null => {
  if (!isObj(v)) return null
  return {
    id: idOf(v.id) ?? fallbackId(),
    name: str(v.name, 'Day'),
    notes: str(v.notes, ''),
    exercises: arrOf(v.exercises, decodeTemplate),
  }
}

const decodeProgram = (v: unknown): Program | null => {
  if (!isObj(v)) return null
  const presetKey = v.presetKey
  return {
    id: idOf(v.id) ?? fallbackId(),
    name: str(v.name, 'My program'),
    days: arrOf(v.days, decodeDay),
    presetKey: presetKey === 'ppl6' || presetKey === 'pplul5' ? presetKey : null,
  }
}

const decodeSet = (v: unknown): LoggedSet | null => {
  if (!isObj(v)) return null
  const done = bool(v.done, false)
  const reps = numOrNull(v.reps)
  return {
    id: idOf(v.id) ?? fallbackId(),
    weight: numOrNull(v.weight),
    reps,
    // Invariant: a done set always has reps. Repair by un-completing.
    done: done && reps !== null,
    warmup: bool(v.warmup, false),
    completedAt: numOrNull(v.completedAt),
  }
}

const decodeSessionExercise = (v: unknown): SessionExercise | null => {
  if (!isObj(v)) return null
  const name = str(v.name, '').trim()
  if (!name) return null
  const repLow = Math.max(1, Math.round(num(v.repLow, 8)))
  const repHigh = Math.max(repLow, Math.round(num(v.repHigh, repLow)))
  return {
    id: idOf(v.id) ?? fallbackId(),
    exerciseId: idOf(v.exerciseId) ?? '',
    name,
    repLow,
    repHigh,
    repCap: Math.max(repHigh, Math.round(num(v.repCap, repHigh + 5))),
    restSec: Math.max(0, Math.round(num(v.restSec, 120))),
    warmupPlan: arrOf(v.warmupPlan, decodeWarmup),
    notes: str(v.notes, ''),
    sets: arrOf(v.sets, decodeSet),
  }
}

const decodeSession = (v: unknown): Session | null => {
  if (!isObj(v)) return null
  const startedAt = numOrNull(v.startedAt)
  if (startedAt === null) return null
  return {
    id: idOf(v.id) ?? fallbackId(),
    programId: idOf(v.programId),
    dayId: idOf(v.dayId),
    dayName: str(v.dayName, 'Workout'),
    dayNotes: str(v.dayNotes, ''),
    startedAt,
    finishedAt: numOrNull(v.finishedAt),
    exercises: arrOf(v.exercises, decodeSessionExercise),
    notes: str(v.notes, ''),
  }
}

const decodeSleep = (v: unknown): SleepEntry | null => {
  if (!isObj(v)) return null
  const night = str(v.night, '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null
  const asleepMin = numOrNull(v.asleepMin)
  if (asleepMin === null || asleepMin < 0 || asleepMin > 24 * 60) return null
  return {
    id: idOf(v.id) ?? fallbackId(),
    night,
    asleepMin: Math.round(asleepMin),
    inBedMin: numOrNull(v.inBedMin),
    source: v.source === 'health' ? 'health' : 'manual',
  }
}

export const decodeRest = (v: unknown): RestState | null => {
  if (!isObj(v)) return null
  const endsAt = numOrNull(v.endsAt)
  const totalSec = numOrNull(v.totalSec)
  if (endsAt === null || totalSec === null || totalSec <= 0) return null
  return { endsAt, totalSec, exerciseName: str(v.exerciseName, '') }
}

export const defaultSettings = (): Settings => ({
  unit: 'lb',
  defaultRestSec: 150,
  autoStartTimer: true,
  weightStep: 5,
  tickSound: true,
  bodyweight: 175,
  barWeight: 45,
})

const decodeSettings = (v: unknown): Settings => {
  const d = defaultSettings()
  if (!isObj(v)) return d
  return {
    // A stored unit always wins; only a truly fresh state gets the lb default.
    unit: v.unit === 'kg' ? 'kg' : v.unit === 'lb' ? 'lb' : d.unit,
    defaultRestSec: Math.max(5, Math.round(num(v.defaultRestSec, d.defaultRestSec))),
    autoStartTimer: bool(v.autoStartTimer, d.autoStartTimer),
    weightStep: Math.max(0.25, num(v.weightStep, d.weightStep)),
    tickSound: bool(v.tickSound, d.tickSound),
    bodyweight: Math.max(0, num(v.bodyweight, d.bodyweight)),
    barWeight: Math.max(0, num(v.barWeight, d.barWeight)),
  }
}

/**
 * Decodes a full v2 state. `fallback` supplies the program/catalog used when
 * the payload has none (the built-in preset, injected by the caller so this
 * module stays preset-free).
 */
export const decodeAppState = (
  raw: unknown,
  fallback: () => Pick<AppState, 'catalog' | 'programs' | 'activeProgramId'>,
): AppState => {
  const v = isObj(raw) ? raw : {}

  const catalogEntries = isObj(v.catalog)
    ? arrOf(Object.values(v.catalog), decodeExercise)
    : []
  let catalog: Record<string, Exercise> = {}
  for (const e of catalogEntries) catalog[e.id] = e

  let programs = arrOf(v.programs, decodeProgram)
  let activeProgramId = idOf(v.activeProgramId)

  if (programs.length === 0) {
    const fb = fallback()
    programs = fb.programs
    activeProgramId = fb.activeProgramId
    catalog = { ...fb.catalog, ...catalog }
  }
  if (!programs.some((p) => p.id === activeProgramId)) {
    activeProgramId = programs[0].id
  }

  const sessions = arrOf(v.sessions, decodeSession)
    .sort((a, b) => (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt))

  // Every referenced exerciseId must exist in the catalog; adopt strays so
  // history lookups never dangle.
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (!e.exerciseId || !catalog[e.exerciseId]) {
        const adopted = makeExercise(e.name)
        catalog[adopted.id] ??= adopted
        e.exerciseId = adopted.id
      }
    }
  }
  for (const p of programs) {
    for (const d of p.days) {
      d.exercises = d.exercises.filter((t) => catalog[t.exerciseId])
    }
  }

  let activeSessionId = idOf(v.activeSessionId)
  const active = sessions.find((s) => s.id === activeSessionId)
  if (!active || active.finishedAt !== null) activeSessionId = null

  const sleep = arrOf(v.sleep, decodeSleep)
    .sort((a, b) => a.night.localeCompare(b.night))

  return {
    version: SCHEMA_VERSION,
    catalog,
    programs,
    activeProgramId: activeProgramId!,
    sessions,
    activeSessionId,
    rest: decodeRest(v.rest),
    sleep,
    settings: decodeSettings(v.settings),
  }
}
