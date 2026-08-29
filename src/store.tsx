import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import type {
  AppState, DayTemplate, ExerciseTemplate, ID, LoggedSet, Session,
  SessionExercise, Settings,
} from './types'
import { load, save } from './lib/storage'
import { move, uid } from './lib/util'
import { defaultSettings, emptyDay } from './lib/defaults'

export type Action =
  | { type: 'replaceState'; state: AppState }
  | { type: 'setSettings'; patch: Partial<Settings> }
  | { type: 'addDay' }
  | { type: 'updateDay'; dayId: ID; patch: Partial<Omit<DayTemplate, 'id' | 'exercises'>> }
  | { type: 'deleteDay'; dayId: ID }
  | { type: 'moveDay'; dayId: ID; delta: number }
  | { type: 'addExercise'; dayId: ID; name?: string }
  | { type: 'updateExercise'; dayId: ID; exId: ID; patch: Partial<Omit<ExerciseTemplate, 'id'>> }
  | { type: 'deleteExercise'; dayId: ID; exId: ID }
  | { type: 'moveExercise'; dayId: ID; exId: ID; delta: number }
  | { type: 'setDayExercises'; dayId: ID; exercises: ExerciseTemplate[] }
  | { type: 'startSession'; dayId: ID }
  | { type: 'finishSession' }
  | { type: 'discardSession' }
  | { type: 'deleteSession'; sessionId: ID }
  | { type: 'setSessionNotes'; notes: string }
  | { type: 'addSessionExercise'; name: string }
  | { type: 'removeSessionExercise'; exId: ID }
  | { type: 'moveSessionExercise'; exId: ID; delta: number }
  | { type: 'addSet'; exId: ID; from?: Partial<LoggedSet> }
  | { type: 'updateSet'; exId: ID; setId: ID; patch: Partial<Omit<LoggedSet, 'id'>> }
  | { type: 'deleteSet'; exId: ID; setId: ID }

const newSet = (from: Partial<LoggedSet> = {}): LoggedSet => ({
  id: uid(),
  weight: from.weight ?? null,
  reps: from.reps ?? null,
  done: false,
  warmup: from.warmup ?? false,
})

const newExerciseTemplate = (name: string, restSec: number): ExerciseTemplate => ({
  id: uid(),
  name,
  sets: 3,
  repLow: 8,
  repHigh: 12,
  restSec,
  notes: '',
})

/** Maps over the active session, leaving state untouched if there isn't one. */
const withSession = (state: AppState, fn: (s: Session) => Session): AppState => {
  if (!state.activeSessionId) return state
  return {
    ...state,
    sessions: state.sessions.map((s) => (s.id === state.activeSessionId ? fn(s) : s)),
  }
}

const withSessionExercise = (
  state: AppState,
  exId: ID,
  fn: (e: SessionExercise) => SessionExercise,
): AppState =>
  withSession(state, (s) => ({
    ...s,
    exercises: s.exercises.map((e) => (e.id === exId ? fn(e) : e)),
  }))

const withDay = (state: AppState, dayId: ID, fn: (d: DayTemplate) => DayTemplate): AppState => ({
  ...state,
  program: {
    ...state.program,
    days: state.program.days.map((d) => (d.id === dayId ? fn(d) : d)),
  },
})

export const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'replaceState':
      return action.state

    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'addDay':
      return {
        ...state,
        program: {
          ...state.program,
          days: [...state.program.days, emptyDay(`Day ${state.program.days.length + 1}`)],
        },
      }

    case 'updateDay':
      return withDay(state, action.dayId, (d) => ({ ...d, ...action.patch }))

    case 'deleteDay':
      return {
        ...state,
        program: {
          ...state.program,
          days: state.program.days.filter((d) => d.id !== action.dayId),
        },
      }

    case 'moveDay': {
      const i = state.program.days.findIndex((d) => d.id === action.dayId)
      if (i < 0) return state
      return {
        ...state,
        program: { ...state.program, days: move(state.program.days, i, i + action.delta) },
      }
    }

    case 'addExercise':
      return withDay(state, action.dayId, (d) => ({
        ...d,
        exercises: [
          ...d.exercises,
          newExerciseTemplate(action.name ?? '', state.settings.defaultRestSec),
        ],
      }))

    case 'updateExercise':
      return withDay(state, action.dayId, (d) => ({
        ...d,
        exercises: d.exercises.map((e) => (e.id === action.exId ? { ...e, ...action.patch } : e)),
      }))

    case 'deleteExercise':
      return withDay(state, action.dayId, (d) => ({
        ...d,
        exercises: d.exercises.filter((e) => e.id !== action.exId),
      }))

    case 'moveExercise': {
      const day = state.program.days.find((d) => d.id === action.dayId)
      if (!day) return state
      const i = day.exercises.findIndex((e) => e.id === action.exId)
      if (i < 0) return state
      return withDay(state, action.dayId, (d) => ({
        ...d,
        exercises: move(d.exercises, i, i + action.delta),
      }))
    }

    case 'setDayExercises':
      return withDay(state, action.dayId, (d) => ({ ...d, exercises: action.exercises }))

    case 'startSession': {
      const day = state.program.days.find((d) => d.id === action.dayId)
      if (!day) return state
      const session: Session = {
        id: uid(),
        dayId: day.id,
        dayName: day.name,
        startedAt: Date.now(),
        finishedAt: null,
        notes: '',
        exercises: day.exercises.map((t) => ({
          id: uid(),
          templateExerciseId: t.id,
          name: t.name,
          repLow: t.repLow,
          repHigh: t.repHigh,
          restSec: t.restSec,
          notes: t.notes,
          sets: Array.from({ length: Math.max(1, t.sets) }, () => newSet()),
        })),
      }
      return { ...state, sessions: [session, ...state.sessions], activeSessionId: session.id }
    }

    case 'finishSession': {
      if (!state.activeSessionId) return state
      const finished = withSession(state, (s) => ({
        ...s,
        finishedAt: Date.now(),
        // Unlogged and empty sets are dropped rather than saved as blanks.
        exercises: s.exercises
          .map((e) => ({ ...e, sets: e.sets.filter((set) => set.done && set.reps !== null) }))
          .filter((e) => e.sets.length > 0),
      }))
      return { ...finished, activeSessionId: null }
    }

    case 'discardSession':
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== state.activeSessionId),
        activeSessionId: null,
      }

    case 'deleteSession':
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== action.sessionId),
        activeSessionId: state.activeSessionId === action.sessionId ? null : state.activeSessionId,
      }

    case 'setSessionNotes':
      return withSession(state, (s) => ({ ...s, notes: action.notes }))

    case 'addSessionExercise':
      return withSession(state, (s) => ({
        ...s,
        exercises: [
          ...s.exercises,
          {
            id: uid(),
            templateExerciseId: null,
            name: action.name,
            repLow: 8,
            repHigh: 12,
            restSec: state.settings.defaultRestSec,
            notes: '',
            sets: [newSet()],
          },
        ],
      }))

    case 'removeSessionExercise':
      return withSession(state, (s) => ({
        ...s,
        exercises: s.exercises.filter((e) => e.id !== action.exId),
      }))

    case 'moveSessionExercise':
      return withSession(state, (s) => {
        const i = s.exercises.findIndex((e) => e.id === action.exId)
        return i < 0 ? s : { ...s, exercises: move(s.exercises, i, i + action.delta) }
      })

    case 'addSet':
      return withSessionExercise(state, action.exId, (e) => ({
        ...e,
        sets: [...e.sets, newSet(action.from)],
      }))

    case 'updateSet':
      return withSessionExercise(state, action.exId, (e) => ({
        ...e,
        sets: e.sets.map((s) => (s.id === action.setId ? { ...s, ...action.patch } : s)),
      }))

    case 'deleteSet':
      return withSessionExercise(state, action.exId, (e) => ({
        ...e,
        sets: e.sets.filter((s) => s.id !== action.setId),
      }))
  }
}

interface Store {
  state: AppState
  dispatch: (a: Action) => void
  activeSession: Session | null
}

const StoreContext = createContext<Store | null>(null)

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    save(state)
  }, [state])

  const value = useMemo<Store>(
    () => ({
      state,
      dispatch,
      activeSession: state.sessions.find((s) => s.id === state.activeSessionId) ?? null,
    }),
    [state],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = (): Store => {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

export const useSettings = () => useStore().state.settings
export { defaultSettings }
