import type {
  AppState, DayTemplate, ExerciseTemplate, Exercise, ID, LoggedSet, Program,
  RestState, Session, SessionExercise, Settings, SleepEntry,
} from '../types'
import { move } from '../lib/util'

/**
 * Pure reducer: no uid(), no Date.now(), no I/O. Anything that needs an id or
 * a timestamp receives it in the action (built by the creators in actions.ts),
 * so (state, action) always maps to exactly one result.
 */
export type Action =
  | { type: 'replaceState'; state: AppState }
  | { type: 'setSettings'; patch: Partial<Settings> }
  // catalog
  | { type: 'upsertCatalog'; exercise: Exercise }
  // programs
  | { type: 'addProgram'; program: Program; activate: boolean }
  | { type: 'renameProgram'; programId: ID; name: string }
  | { type: 'deleteProgram'; programId: ID }
  | { type: 'setActiveProgram'; programId: ID }
  | { type: 'addDay'; programId: ID; day: DayTemplate }
  | { type: 'updateDay'; programId: ID; dayId: ID; patch: Partial<Omit<DayTemplate, 'id' | 'exercises'>> }
  | { type: 'deleteDay'; programId: ID; dayId: ID }
  | { type: 'moveDay'; programId: ID; dayId: ID; delta: number }
  | { type: 'addTemplate'; programId: ID; dayId: ID; template: ExerciseTemplate }
  | { type: 'updateTemplate'; programId: ID; dayId: ID; templateId: ID; patch: Partial<Omit<ExerciseTemplate, 'id'>> }
  | { type: 'deleteTemplate'; programId: ID; dayId: ID; templateId: ID }
  | { type: 'moveTemplate'; programId: ID; dayId: ID; templateId: ID; delta: number }
  | { type: 'setDayTemplates'; programId: ID; dayId: ID; templates: ExerciseTemplate[] }
  // sessions
  | { type: 'startSession'; session: Session }
  | { type: 'resumeSession'; sessionId: ID }
  | { type: 'finishSession'; now: number }
  | { type: 'discardActiveSession' }
  | { type: 'deleteSession'; sessionId: ID }
  | { type: 'setSessionNotes'; notes: string }
  | { type: 'addSessionExercise'; exercise: SessionExercise }
  | { type: 'removeSessionExercise'; exId: ID }
  | { type: 'moveSessionExercise'; exId: ID; delta: number }
  | { type: 'addSet'; exId: ID; set: LoggedSet }
  | { type: 'setSets'; exId: ID; sets: LoggedSet[] }
  | { type: 'updateSet'; exId: ID; setId: ID; patch: Partial<Pick<LoggedSet, 'weight' | 'reps' | 'warmup'>> }
  | { type: 'completeSet'; exId: ID; setId: ID; weight: number | null; reps: number; now: number }
  | { type: 'uncompleteSet'; exId: ID; setId: ID }
  | { type: 'deleteSet'; exId: ID; setId: ID }
  // rest timer
  | { type: 'startRest'; rest: RestState }
  | { type: 'extendRest'; bySec: number }
  | { type: 'stopRest' }
  // sleep
  | { type: 'upsertSleep'; entries: SleepEntry[] }
  | { type: 'deleteSleep'; entryId: ID }
  // sample data
  | { type: 'addSessions'; sessions: Session[] }
  | { type: 'removeTagged'; prefix: string }

const withProgram = (state: AppState, programId: ID, fn: (p: Program) => Program): AppState => ({
  ...state,
  programs: state.programs.map((p) => (p.id === programId ? fn(p) : p)),
})

const withDay = (
  state: AppState, programId: ID, dayId: ID, fn: (d: DayTemplate) => DayTemplate,
): AppState =>
  withProgram(state, programId, (p) => ({
    ...p,
    days: p.days.map((d) => (d.id === dayId ? fn(d) : d)),
  }))

const withActiveSession = (state: AppState, fn: (s: Session) => Session): AppState => {
  if (!state.activeSessionId) return state
  return {
    ...state,
    sessions: state.sessions.map((s) => (s.id === state.activeSessionId ? fn(s) : s)),
  }
}

const withSessionExercise = (
  state: AppState, exId: ID, fn: (e: SessionExercise) => SessionExercise,
): AppState =>
  withActiveSession(state, (s) => ({
    ...s,
    exercises: s.exercises.map((e) => (e.id === exId ? fn(e) : e)),
  }))

export const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'replaceState':
      return action.state

    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'upsertCatalog':
      return { ...state, catalog: { ...state.catalog, [action.exercise.id]: action.exercise } }

    case 'addProgram':
      return {
        ...state,
        programs: [...state.programs, action.program],
        activeProgramId: action.activate ? action.program.id : state.activeProgramId,
      }

    case 'renameProgram':
      return withProgram(state, action.programId, (p) => ({
        ...p,
        name: action.name.trim() || p.name,
      }))

    case 'deleteProgram': {
      if (state.programs.length <= 1) return state
      const programs = state.programs.filter((p) => p.id !== action.programId)
      return {
        ...state,
        programs,
        activeProgramId: programs.some((p) => p.id === state.activeProgramId)
          ? state.activeProgramId
          : programs[0].id,
      }
    }

    case 'setActiveProgram':
      return state.programs.some((p) => p.id === action.programId)
        ? { ...state, activeProgramId: action.programId }
        : state

    case 'addDay':
      return withProgram(state, action.programId, (p) => ({
        ...p,
        days: [...p.days, action.day],
      }))

    case 'updateDay':
      return withDay(state, action.programId, action.dayId, (d) => ({ ...d, ...action.patch }))

    case 'deleteDay':
      return withProgram(state, action.programId, (p) => ({
        ...p,
        days: p.days.filter((d) => d.id !== action.dayId),
      }))

    case 'moveDay':
      return withProgram(state, action.programId, (p) => {
        const i = p.days.findIndex((d) => d.id === action.dayId)
        return i < 0 ? p : { ...p, days: move(p.days, i, i + action.delta) }
      })

    case 'addTemplate':
      return withDay(state, action.programId, action.dayId, (d) => ({
        ...d,
        exercises: [...d.exercises, action.template],
      }))

    case 'updateTemplate':
      return withDay(state, action.programId, action.dayId, (d) => ({
        ...d,
        exercises: d.exercises.map((t) => (t.id === action.templateId ? { ...t, ...action.patch } : t)),
      }))

    case 'deleteTemplate':
      return withDay(state, action.programId, action.dayId, (d) => ({
        ...d,
        exercises: d.exercises.filter((t) => t.id !== action.templateId),
      }))

    case 'moveTemplate':
      return withDay(state, action.programId, action.dayId, (d) => {
        const i = d.exercises.findIndex((t) => t.id === action.templateId)
        return i < 0 ? d : { ...d, exercises: move(d.exercises, i, i + action.delta) }
      })

    case 'setDayTemplates':
      return withDay(state, action.programId, action.dayId, (d) => ({
        ...d,
        exercises: action.templates,
      }))

    case 'startSession':
      // Invariant: never two live sessions. Resume/finish the current one first.
      if (state.activeSessionId !== null) return state
      return {
        ...state,
        sessions: [action.session, ...state.sessions],
        activeSessionId: action.session.id,
      }

    case 'resumeSession': {
      if (state.activeSessionId !== null) return state
      const target = state.sessions.find((s) => s.id === action.sessionId)
      if (!target || target.finishedAt !== null) return state
      return { ...state, activeSessionId: action.sessionId }
    }

    case 'finishSession': {
      if (!state.activeSessionId) return state
      const finished = withActiveSession(state, (s) => ({
        ...s,
        finishedAt: action.now,
        // Sets never ticked off are dropped; done sets always survive.
        exercises: s.exercises
          .map((e) => ({ ...e, sets: e.sets.filter((set) => set.done) }))
          .filter((e) => e.sets.length > 0),
      }))
      return { ...finished, activeSessionId: null, rest: null }
    }

    case 'discardActiveSession':
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== state.activeSessionId),
        activeSessionId: null,
        rest: null,
      }

    case 'deleteSession':
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== action.sessionId),
        activeSessionId: state.activeSessionId === action.sessionId ? null : state.activeSessionId,
      }

    case 'setSessionNotes':
      return withActiveSession(state, (s) => ({ ...s, notes: action.notes }))

    case 'addSessionExercise':
      return withActiveSession(state, (s) => ({
        ...s,
        exercises: [...s.exercises, action.exercise],
      }))

    case 'removeSessionExercise':
      return withActiveSession(state, (s) => ({
        ...s,
        exercises: s.exercises.filter((e) => e.id !== action.exId),
      }))

    case 'moveSessionExercise':
      return withActiveSession(state, (s) => {
        const i = s.exercises.findIndex((e) => e.id === action.exId)
        return i < 0 ? s : { ...s, exercises: move(s.exercises, i, i + action.delta) }
      })

    case 'addSet':
      return withSessionExercise(state, action.exId, (e) => ({
        ...e,
        sets: [...e.sets, action.set],
      }))

    case 'setSets':
      // Whole-list replacement, used by the warm-up ramp as it follows the
      // working weight. Anything already logged has to survive it.
      return withSessionExercise(state, action.exId, (e) => {
        const kept = e.sets.filter((s) => s.done)
        const survives = kept.every((s) => action.sets.some((x) => x.id === s.id && x.done))
        return survives ? { ...e, sets: action.sets } : e
      })

    case 'updateSet':
      // Invariant: a logged set is history. Only uncompleting it reopens it,
      // so a gesture that settles late can never rewrite what you recorded.
      return withSessionExercise(state, action.exId, (e) => ({
        ...e,
        sets: e.sets.map((s) =>
          s.id === action.setId && !s.done ? { ...s, ...action.patch } : s,
        ),
      }))

    case 'completeSet':
      // Invariant: a done set always has concrete reps.
      if (!Number.isFinite(action.reps) || action.reps <= 0) return state
      return withSessionExercise(state, action.exId, (e) => ({
        ...e,
        sets: e.sets.map((s) =>
          s.id === action.setId
            ? { ...s, weight: action.weight, reps: action.reps, done: true, completedAt: action.now }
            : s,
        ),
      }))

    case 'uncompleteSet':
      return withSessionExercise(state, action.exId, (e) => ({
        ...e,
        sets: e.sets.map((s) =>
          s.id === action.setId ? { ...s, done: false, completedAt: null } : s,
        ),
      }))

    case 'deleteSet':
      return withSessionExercise(state, action.exId, (e) => ({
        ...e,
        sets: e.sets.filter((s) => s.id !== action.setId),
      }))

    case 'startRest':
      return { ...state, rest: action.rest }

    case 'extendRest':
      return state.rest
        ? {
            ...state,
            rest: {
              ...state.rest,
              endsAt: state.rest.endsAt + action.bySec * 1000,
              totalSec: state.rest.totalSec + action.bySec,
            },
          }
        : state

    case 'stopRest':
      return state.rest ? { ...state, rest: null } : state

    case 'upsertSleep': {
      // Keyed by (night, source): re-imports and re-logs replace, not duplicate.
      const byKey = new Map(state.sleep.map((e) => [`${e.night}|${e.source}`, e]))
      for (const entry of action.entries) byKey.set(`${entry.night}|${entry.source}`, entry)
      return {
        ...state,
        sleep: [...byKey.values()].sort((a, b) => a.night.localeCompare(b.night)),
      }
    }

    case 'deleteSleep':
      return { ...state, sleep: state.sleep.filter((e) => e.id !== action.entryId) }

    case 'addSessions':
      return {
        ...state,
        sessions: [...action.sessions, ...state.sessions].sort(
          (a, b) => (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt),
        ),
      }

    case 'removeTagged':
      return {
        ...state,
        sessions: state.sessions.filter((s) => !s.id.startsWith(action.prefix)),
        sleep: state.sleep.filter((e) => !e.id.startsWith(action.prefix)),
        activeSessionId: state.activeSessionId?.startsWith(action.prefix)
          ? null
          : state.activeSessionId,
      }
  }
}
