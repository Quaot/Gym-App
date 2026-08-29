import { useRef, useSyncExternalStore } from 'react'
import type { AppState } from '../types'
import { reducer } from './reducer'
import type { Action } from './reducer'

export class AppStore {
  private state: AppState
  private listeners = new Set<() => void>()

  constructor(initial: AppState) {
    this.state = initial
  }

  getState = (): AppState => this.state

  dispatch = (action: Action): void => {
    const next = reducer(this.state, action)
    if (next === this.state) return
    this.state = next
    for (const fn of this.listeners) fn()
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

/** The singleton, created in main.tsx after load/migrate. */
let store: AppStore | null = null

export const initStore = (initial: AppState): AppStore => {
  store = new AppStore(initial)
  return store
}

export const getStore = (): AppStore => {
  if (!store) throw new Error('Store used before initStore()')
  return store
}

export const dispatch = (action: Action): void => getStore().dispatch(action)

/**
 * Subscribe to a slice. Components re-render only when their selected value
 * changes (Object.is, or a custom equality for derived arrays/objects).
 */
export const useAppSelector = <T>(
  selector: (s: AppState) => T,
  equals: (a: T, b: T) => boolean = Object.is,
): T => {
  const s = getStore()
  // Cache the last snapshot so unrelated dispatches return a stable reference.
  const last = useRef<{ value: T } | null>(null)
  return useSyncExternalStore(s.subscribe, () => {
    const next = selector(s.getState())
    if (last.current && equals(last.current.value, next)) return last.current.value
    last.current = { value: next }
    return next
  })
}

export const shallowEq = <T>(a: T, b: T): boolean => {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a) as (keyof T)[]
  const kb = Object.keys(b) as (keyof T)[]
  return ka.length === kb.length && ka.every((k) => Object.is(a[k], b[k]))
}
