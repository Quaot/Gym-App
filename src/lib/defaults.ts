import type { AppState, DayTemplate, Program, Settings } from '../types'
import { uid } from './util'
import { pplProgram } from './presets'

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
  notes: '',
  exercises: [],
})

export const defaultProgram = (): Program => pplProgram()

export const initialState = (): AppState => ({
  version: SCHEMA_VERSION,
  program: defaultProgram(),
  sessions: [],
  activeSessionId: null,
  settings: defaultSettings(),
})
