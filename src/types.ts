export type ID = string
export type Unit = 'kg' | 'lb'

export const SCHEMA_VERSION = 4

/**
 * Catalog entry — the stable identity of a movement. Templates and logged
 * sessions reference exercises by id, so renames and split switches never
 * fork an exercise's history. Preset exercises use slug ids
 * ('barbell-bench-press'); user-created ones get uids.
 */
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight'

export interface Exercise {
  id: ID
  name: string
  /** Reps-based PRs and volume; no weight expected. */
  bodyweight: boolean
  equipment: Equipment
  /** Smallest loadable jump for this movement, in the user's unit. */
  increment: number
  archived: boolean
}

/** One warm-up prescription: a share of the working weight for some reps. */
export interface WarmupStep {
  /** Fraction of the planned working weight, 0 to 1. */
  pct: number
  reps: number
}

/** An exercise as programmed in a day template. */
export interface ExerciseTemplate {
  id: ID
  exerciseId: ID
  sets: number
  repLow: number
  repHigh: number
  /** Ceiling the range may extend to before a load jump is forced. */
  repCap: number
  /** Rest between sets, seconds. */
  restSec: number
  warmups: WarmupStep[]
  notes: string
}

/** One trainable day, e.g. "Push 1". */
export interface DayTemplate {
  id: ID
  name: string
  /** Warm-up protocol or anything that applies to the whole day. */
  notes: string
  exercises: ExerciseTemplate[]
}

export interface Program {
  id: ID
  name: string
  days: DayTemplate[]
  /** Which built-in split this came from, if any. */
  presetKey: 'ppl6' | 'pplul5' | null
}

export interface LoggedSet {
  id: ID
  weight: number | null
  reps: number | null
  done: boolean
  /** Marks a warm-up set so it is excluded from PRs and volume. */
  warmup: boolean
  /** Wall-clock ms when the set was completed; null until done. */
  completedAt: number | null
}

/** An exercise inside a live or finished session. Copied from the template at
 *  start so later template edits never rewrite past workouts. */
export interface SessionExercise {
  id: ID
  exerciseId: ID
  /** Name snapshot, so old sessions display correctly after catalog renames. */
  name: string
  repLow: number
  repHigh: number
  repCap: number
  restSec: number
  warmupPlan: WarmupStep[]
  notes: string
  sets: LoggedSet[]
}

export interface Session {
  id: ID
  programId: ID | null
  dayId: ID | null
  dayName: string
  dayNotes: string
  startedAt: number
  finishedAt: number | null
  exercises: SessionExercise[]
  notes: string
}

/** The global rest timer — store data so it survives navigation and reload. */
export interface RestState {
  /** Wall-clock ms deadline. */
  endsAt: number
  totalSec: number
  /** What the rest is for, so the bar can show context. */
  exerciseName: string
}

export interface SleepEntry {
  id: ID
  /** 'YYYY-MM-DD' of the morning the sleep ended. */
  night: string
  asleepMin: number
  inBedMin: number | null
  source: 'manual' | 'health'
}

export interface Settings {
  unit: Unit
  defaultRestSec: number
  autoStartTimer: boolean
  /** Weight increment the tape input snaps to. */
  weightStep: number
  /** Audible detent ticks on the tape input. */
  tickSound: boolean
  /** Your bodyweight, used to size jumps on bodyweight movements. */
  bodyweight: number
  /** The bar you load, so the app can tell you which plates to hang on it. */
  barWeight: number
}

export interface AppState {
  version: typeof SCHEMA_VERSION
  catalog: Record<ID, Exercise>
  programs: Program[]
  activeProgramId: ID
  sessions: Session[]
  activeSessionId: ID | null
  rest: RestState | null
  sleep: SleepEntry[]
  settings: Settings
}
