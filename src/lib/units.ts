import type { AppState, Unit } from '../types'
import { defaultIncrement } from './catalog'
import { defaultBar } from './plates'

/**
 * Changing the unit, properly.
 *
 * Setting `unit` used to be a pure relabel: a 225 lb squat became a 225 kg
 * squat, across every logged set, every increment and the bar itself, and the
 * plate maths flipped to a kilo bar underneath it. Nothing warned you and
 * nothing could be undone. So a unit change is a transformation of the whole
 * state, and the screen that offers it says so first.
 */

const LB_PER_KG = 2.2046226218

/** A weight in the other unit, rounded to something a gym actually has. */
export const convertWeight = (weight: number, from: Unit, to: Unit): number => {
  if (from === to) return weight
  const raw = to === 'kg' ? weight / LB_PER_KG : weight * LB_PER_KG
  // Half a kilo, or a whole pound: fine enough that a round trip comes back
  // to the weight you started from, coarse enough to read on a card.
  const grid = to === 'kg' ? 0.5 : 1
  return Math.round(raw / grid) * grid
}

/** The tape's step, which is conventional rather than converted: 5 lb is 2.5 kg. */
export const defaultStep = (unit: Unit): number => (unit === 'kg' ? 2.5 : 5)

/** Logged sets carrying a weight, which is what the confirmation counts. */
export const weighedSetCount = (state: AppState): number =>
  state.sessions.reduce(
    (n, s) => n + s.exercises.reduce(
      (m, e) => m + e.sets.filter((x) => x.weight !== null).length, 0), 0)

/**
 * Every stored weight in the new unit. Logged sets are converted so history
 * still means what it meant; the bar, the step and the catalog increments are
 * reset to the new unit's conventional values, because those are choices
 * about equipment rather than measurements of it.
 */
export const convertState = (state: AppState, to: Unit): AppState => {
  const from = state.settings.unit
  if (from === to) return state
  const w = (v: number | null) => (v === null ? null : convertWeight(v, from, to))

  const catalog = Object.fromEntries(
    Object.entries(state.catalog).map(([id, e]) => [
      id, { ...e, increment: defaultIncrement(e.equipment, to) },
    ]),
  )

  return {
    ...state,
    settings: {
      ...state.settings,
      unit: to,
      weightStep: defaultStep(to),
      barWeight: defaultBar(to),
      bodyweight: Math.round(convertWeight(state.settings.bodyweight, from, to)),
    },
    catalog,
    sessions: state.sessions.map((s) => ({
      ...s,
      exercises: s.exercises.map((e) => ({
        ...e,
        sets: e.sets.map((set) => ({ ...set, weight: w(set.weight) })),
      })),
    })),
  }
}
