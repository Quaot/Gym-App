import type { AppState, DayTemplate, Program, Settings } from '../types'
import { uid } from './util'

export const SCHEMA_VERSION = 1

export const defaultSettings = (): Settings => ({
  unit: 'kg',
  defaultRestSec: 150,
  autoStartTimer: true,
  weightStep: 2.5,
})

export const emptyDay = (name: string): DayTemplate => ({
  id: uid(),
  name,
  exercises: [],
})

/** Push / Pull / Legs shells — exercises are yours to fill in. */
export const defaultProgram = (): Program => ({
  id: uid(),
  name: 'Push / Pull / Legs',
  days: [emptyDay('Push'), emptyDay('Pull'), emptyDay('Legs')],
})

export const initialState = (): AppState => ({
  version: SCHEMA_VERSION,
  program: defaultProgram(),
  sessions: [],
  activeSessionId: null,
  settings: defaultSettings(),
})
