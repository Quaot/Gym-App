import { describe, expect, it } from 'vitest'
import { convertState, convertWeight, defaultStep, weighedSetCount } from './units'
import { freshState } from '../store/migrate'
import type { AppState, LoggedSet, Session } from '../types'

let n = 0
const set = (weight: number | null): LoggedSet => ({
  id: `s${n++}`, weight, reps: 5, done: true, warmup: false, completedAt: 1,
})

const withSets = (weights: (number | null)[]): AppState => {
  const base = freshState()
  const session: Session = {
    id: 'sess', programId: null, dayId: null, dayName: 'Push 1', dayNotes: '',
    startedAt: 1, finishedAt: 2, notes: '',
    exercises: [{
      id: 'e1', exerciseId: 'barbell-bench-press', name: 'Barbell Bench Press',
      repLow: 5, repHigh: 8, repCap: 13, restSec: 180, warmupPlan: [], notes: '',
      sets: weights.map(set),
    }],
  }
  return { ...base, sessions: [session] }
}

describe('converting a weight', () => {
  it('turns a barbell into the same barbell', () => {
    expect(convertWeight(45, 'lb', 'kg')).toBe(20.5)
    expect(convertWeight(20, 'kg', 'lb')).toBe(44)
  })

  it('lands on something a gym can actually load', () => {
    for (const lb of [95, 135, 185, 225, 315, 405]) {
      const kg = convertWeight(lb, 'lb', 'kg')
      expect(kg * 2, `${lb} lb`).toBe(Math.round(kg * 2)) // a half kilo grid
    }
  })

  it('comes back to where it started on a round trip', () => {
    for (const lb of [45, 95, 135, 185, 225, 315, 405, 500]) {
      const back = convertWeight(convertWeight(lb, 'lb', 'kg'), 'kg', 'lb')
      expect(Math.abs(back - lb), `${lb} lb round trip gave ${back}`).toBeLessThanOrEqual(1)
    }
  })

  it('leaves a weight alone when the unit is not changing', () => {
    expect(convertWeight(225, 'lb', 'lb')).toBe(225)
  })
})

describe('converting the whole state', () => {
  it('rewrites every logged weight, which a relabel never did', () => {
    const out = convertState(withSets([225, 135, null]), 'kg')
    const weights = out.sessions[0].exercises[0].sets.map((s) => s.weight)
    expect(weights[0]).toBeCloseTo(102, 0)
    expect(weights[1]).toBeCloseTo(61, 0)
    expect(weights[2]).toBeNull()
  })

  it('never leaves a weight untouched, which is the bug it exists to fix', () => {
    const before = withSets([225, 135])
    const after = convertState(before, 'kg')
    const beforeW = before.sessions[0].exercises[0].sets.map((s) => s.weight)
    const afterW = after.sessions[0].exercises[0].sets.map((s) => s.weight)
    expect(afterW).not.toEqual(beforeW)
  })

  it('gives you the bar that unit actually uses', () => {
    expect(convertState(withSets([225]), 'kg').settings.barWeight).toBe(20)
    const kg = { ...withSets([100]), settings: { ...freshState().settings, unit: 'kg' as const } }
    expect(convertState(kg, 'lb').settings.barWeight).toBe(45)
  })

  it('resets the step and the increments to the new unit conventions', () => {
    const out = convertState(withSets([225]), 'kg')
    expect(out.settings.weightStep).toBe(defaultStep('kg'))
    expect(out.catalog['barbell-bench-press'].increment).toBe(2.5)
  })

  it('converts your bodyweight with everything else', () => {
    // 175 lb is 79.4 kg, which lands on the half kilo grid and then rounds to
    // a whole number, since nobody logs a bodyweight to the half kilo.
    const out = convertState(withSets([225]), 'kg')
    expect(out.settings.bodyweight).toBe(80)
  })

  it('changes nothing at all when the unit is already right', () => {
    const state = withSets([225])
    expect(convertState(state, 'lb')).toBe(state)
  })

  it('round trips the state to within a pound, which is the stated bound', () => {
    // Rounding at both ends cannot be lossless. A pound is close enough that
    // no history reads wrong, and it is what convertWeight promises above.
    const there = convertState(withSets([225, 135, 95]), 'kg')
    const back = convertState(there, 'lb')
    const weights = back.sessions[0].exercises[0].sets.map((s) => s.weight)
    for (const [i, want] of [225, 135, 95].entries()) {
      expect(Math.abs((weights[i] ?? 0) - want), `${want} lb`).toBeLessThanOrEqual(1)
    }
  })
})

describe('what the confirmation counts', () => {
  it('counts only the sets that carry a weight', () => {
    expect(weighedSetCount(withSets([225, null, 135]))).toBe(2)
  })

  it('counts nothing on a fresh install', () => {
    expect(weighedSetCount(freshState())).toBe(0)
  })
})
