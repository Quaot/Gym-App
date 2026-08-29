export type ID = string
export type Unit = 'kg' | 'lb'

/** An exercise as programmed in a day template. */
export interface ExerciseTemplate {
  id: ID
  name: string
  sets: number
  repLow: number
  repHigh: number
  /** Rest between sets, seconds. */
  restSec: number
  notes: string
}

/** One trainable day, e.g. "Push A". */
export interface DayTemplate {
  id: ID
  name: string
  exercises: ExerciseTemplate[]
}

export interface Program {
  id: ID
  name: string
  days: DayTemplate[]
}

export interface LoggedSet {
  id: ID
  weight: number | null
  reps: number | null
  done: boolean
  /** Marks a warm-up set so it is excluded from PRs and prefill. */
  warmup: boolean
}

/** An exercise inside a live or finished session. Copied from the template at
 *  start so later template edits never rewrite past workouts. */
export interface SessionExercise {
  id: ID
  templateExerciseId: ID | null
  name: string
  repLow: number
  repHigh: number
  restSec: number
  notes: string
  sets: LoggedSet[]
}

export interface Session {
  id: ID
  dayId: ID | null
  dayName: string
  startedAt: number
  finishedAt: number | null
  exercises: SessionExercise[]
  notes: string
}

export interface Settings {
  unit: Unit
  defaultRestSec: number
  autoStartTimer: boolean
  /** Weight increment for the +/- steppers. */
  weightStep: number
}

export interface AppState {
  version: number
  program: Program
  sessions: Session[]
  activeSessionId: ID | null
  settings: Settings
}
