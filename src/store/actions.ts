import type {
  AppState, DayTemplate, Exercise, ID, LoggedSet, Program, Session, SessionExercise,
} from '../types'
import type { Action } from './reducer'
import { dispatch, getStore } from './store'
import { uid } from '../lib/util'
import { resolveExercise } from '../lib/catalog'
import { prefillFor } from '../lib/prefill'
import { suggestionFor } from '../lib/suggest'
import { warmupRows } from '../lib/warmups'
import { startRestUnlockingAudio } from '../lib/audio'

/**
 * Action creators own all the impurity (uid, Date.now, reads of current
 * state): they build complete entities and hand the pure reducer composed
 * payloads. UI code calls these, never dispatches raw objects.
 */

export const newSet = (): LoggedSet => ({
  id: uid(),
  weight: null,
  reps: null,
  done: false,
  warmup: false,
  completedAt: null,
})

export const emptyDay = (name: string): DayTemplate => ({
  id: uid(),
  name,
  notes: '',
  exercises: [],
})

const activeProgram = (s: AppState): Program =>
  s.programs.find((p) => p.id === s.activeProgramId) ?? s.programs[0]

export const act = {
  /** Starts a workout from a day template. No-ops if one is already live. */
  startSession(dayId: ID): void {
    const s = getStore().getState()
    if (s.activeSessionId !== null) return
    const program = activeProgram(s)
    const day = program.days.find((d) => d.id === dayId)
    if (!day) return
    const session: Session = {
      id: uid(),
      programId: program.id,
      dayId: day.id,
      dayName: day.name,
      dayNotes: day.notes,
      startedAt: Date.now(),
      finishedAt: null,
      notes: '',
      exercises: day.exercises.map((t) => {
        const exercise: SessionExercise = {
          id: uid(),
          exerciseId: t.exerciseId,
          name: s.catalog[t.exerciseId]?.name ?? 'Exercise',
          repLow: t.repLow,
          repHigh: t.repHigh,
          repCap: t.repCap,
          restSec: t.restSec,
          warmupPlan: t.warmups,
          notes: t.notes,
          sets: Array.from({ length: Math.max(1, t.sets) }, newSet),
        }

        // Warm-ups ride on the weight you are about to work with, so they are
        // built from the progression suggestion rather than typed in again.
        const planned = suggestionFor(s, exercise).suggestion.weight
        const increment = s.catalog[t.exerciseId]?.increment ?? s.settings.weightStep
        const rows = warmupRows(t.warmups, planned, increment)
        if (rows.length > 0) {
          exercise.sets = [
            ...rows.map((row) => ({ ...newSet(), weight: row.weight, reps: row.reps, warmup: true })),
            ...exercise.sets,
          ]
        }
        return exercise
      }),
    }
    dispatch({ type: 'startSession', session })
  },

  finishSession(): void {
    dispatch({ type: 'finishSession', now: Date.now() })
  },

  /**
   * Completes a set. Values the user left untouched resolve through prefill;
   * if reps still can't be resolved the completion is refused (returns false)
   * so the UI can prompt rather than silently drop data.
   */
  completeSet(exId: ID, setId: ID): boolean {
    const s = getStore().getState()
    const session = s.sessions.find((x) => x.id === s.activeSessionId)
    const exercise = session?.exercises.find((e) => e.id === exId)
    const index = exercise?.sets.findIndex((x) => x.id === setId) ?? -1
    if (!session || !exercise || index < 0) return false
    const set = exercise.sets[index]

    const fill = prefillFor(s, session, exercise, index)
    const weight = set.weight ?? fill.weight
    const reps = set.reps ?? fill.reps
    if (reps === null || reps <= 0) return false

    dispatch({ type: 'completeSet', exId, setId, weight, reps, now: Date.now() })

    if (s.settings.autoStartTimer && !set.warmup) {
      act.startRest(exercise.restSec ?? s.settings.defaultRestSec, exercise.name)
    }
    return true
  },

  /** Starts the rest timer. Runs inside the tap's gesture, unlocking audio. */
  startRest(seconds: number, exerciseName = ''): void {
    if (seconds <= 0) return
    startRestUnlockingAudio()
    dispatch({
      type: 'startRest',
      rest: { endsAt: Date.now() + seconds * 1000, totalSec: seconds, exerciseName },
    })
  },

  addSessionExercise(name: string): void {
    const s = getStore().getState()
    const exercise = resolveExercise(s.catalog, name, s.settings.unit)
    if (!s.catalog[exercise.id]) dispatch({ type: 'upsertCatalog', exercise })
    dispatch({
      type: 'addSessionExercise',
      exercise: {
        id: uid(),
        exerciseId: exercise.id,
        name: exercise.name,
        repLow: 8,
        repHigh: 12,
        repCap: 17,
        restSec: s.settings.defaultRestSec,
        warmupPlan: [],
        notes: '',
        sets: [newSet()],
      },
    })
  },

  addSet(exId: ID): void {
    dispatch({ type: 'addSet', exId, set: newSet() })
  },

  addTemplate(programId: ID, dayId: ID, name: string): void {
    const s = getStore().getState()
    const exercise = resolveExercise(s.catalog, name, s.settings.unit)
    if (!s.catalog[exercise.id]) dispatch({ type: 'upsertCatalog', exercise })
    dispatch({
      type: 'addTemplate',
      programId,
      dayId,
      template: {
        id: uid(),
        exerciseId: exercise.id,
        sets: 3,
        repLow: 8,
        repHigh: 12,
        repCap: 17,
        restSec: s.settings.defaultRestSec,
        warmups: [],
        notes: '',
      },
    })
  },

  addDay(programId: ID): void {
    const s = getStore().getState()
    const program = s.programs.find((p) => p.id === programId)
    dispatch({
      type: 'addDay',
      programId,
      day: emptyDay(`Day ${(program?.days.length ?? 0) + 1}`),
    })
  },

  addProgramFromPreset(build: () => { program: Program; catalog: Record<ID, Exercise> }): void {
    const { program, catalog } = build()
    for (const exercise of Object.values(catalog)) {
      const existing = getStore().getState().catalog[exercise.id]
      if (!existing) dispatch({ type: 'upsertCatalog', exercise })
    }
    dispatch({ type: 'addProgram', program, activate: true })
  },

  /** Raw dispatch for the simple pass-through actions. */
  raw(action: Action): void {
    dispatch(action)
  },
}
