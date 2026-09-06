import { describe, expect, it } from 'vitest'
import { defaultIncrement, makeExercise } from './catalog'

describe('what each kind of equipment steps by', () => {
  it('moves a dumbbell in the smallest jump there is', () => {
    // Ten pounds on an Arnold press is a third of the working weight.
    expect(defaultIncrement('dumbbell', 'lb')).toBe(2.5)
    expect(defaultIncrement('dumbbell', 'kg')).toBe(1.25)
  })

  it('leaves a barbell where it was', () => {
    expect(defaultIncrement('barbell', 'lb')).toBe(5)
    expect(defaultIncrement('barbell', 'kg')).toBe(2.5)
  })

  it('leaves a stack where it was, since a stack is rarely finer', () => {
    for (const kind of ['machine', 'cable'] as const) {
      expect(defaultIncrement(kind, 'lb'), kind).toBe(10)
      expect(defaultIncrement(kind, 'kg'), kind).toBe(5)
    }
  })

  it('keeps every unit pair at the two to one the table has always used', () => {
    for (const kind of ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'] as const) {
      expect(defaultIncrement(kind, 'lb') / defaultIncrement(kind, 'kg'), kind).toBe(2)
    }
  })

  it('never offers a step of zero, which would freeze a wheel', () => {
    for (const kind of ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'] as const) {
      for (const unit of ['lb', 'kg'] as const) {
        expect(defaultIncrement(kind, unit), `${kind} ${unit}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('a new exercise takes the step its name implies', () => {
  it('reads dumbbell out of the name', () => {
    const e = makeExercise('Standing Dumbbell Curl')
    expect(e.equipment).toBe('dumbbell')
    expect(e.increment).toBe(2.5)
  })

  it('mints it in the unit it was given', () => {
    expect(makeExercise('Standing Dumbbell Curl', undefined, 'kg').increment).toBe(1.25)
  })
})
