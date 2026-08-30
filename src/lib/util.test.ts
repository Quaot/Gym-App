import { describe, expect, it } from 'vitest'
import { daysAgo, plural, pluralize, roundToStep } from './util'

const at = (dayOffset: number, hour: number): number => {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}

describe('daysAgo counts midnights, not hours', () => {
  it('calls this morning today', () => {
    expect(daysAgo(at(0, 7))).toBe(0)
  })

  it('calls yesterday evening one day, which elapsed hours called zero', () => {
    // 8pm yesterday read at 9am today is thirteen hours: the old arithmetic
    // divided by 24 and printed "0d ago" for a workout you did last night.
    const now = at(0, 9)
    expect(daysAgo(at(-1, 20), now)).toBe(1)
  })

  it('calls last night early this morning one day too', () => {
    expect(daysAgo(at(-1, 23), at(0, 1))).toBe(1)
  })

  it('counts a week as seven whatever the clock says', () => {
    expect(daysAgo(at(-7, 23), at(0, 1))).toBe(7)
  })

  it('never goes negative for something logged earlier today', () => {
    expect(daysAgo(at(0, 23), at(0, 23))).toBe(0)
  })
})

describe('plural', () => {
  it('says one set, not one sets', () => {
    expect(plural(1, 'set')).toBe('1 set')
    expect(plural(2, 'set')).toBe('2 sets')
    expect(plural(0, 'set')).toBe('0 sets')
  })

  it('takes an irregular plural where the s does not work', () => {
    expect(plural(1, 'day')).toBe('1 day')
    expect(plural(3, 'exercise')).toBe('3 exercises')
  })

  it('gives the word alone when the number is already on screen', () => {
    expect(pluralize(1, 'set')).toBe('set')
    expect(pluralize(21, 'set')).toBe('sets')
  })
})

describe('roundToStep, which the tapes and the warm-ups share', () => {
  it('lands on the grid', () => {
    expect(roundToStep(51.25, 2.5)).toBe(52.5)
    expect(roundToStep(101, 5)).toBe(100)
  })
})
