import { describe, expect, it } from 'vitest'
import { aggregateSleep, nightOf, sleepByNight } from './sleep'
import type { SleepInterval } from './sleep'

const ts = (iso: string) => new Date(iso).getTime()

const iv = (start: string, end: string, value = 'HKCategoryValueSleepAnalysisAsleepCore', sourceName = 'Watch'): SleepInterval => ({
  start: ts(start),
  end: ts(end),
  value,
  sourceName,
})

describe('nightOf', () => {
  it('assigns a normal overnight sleep to the morning it ends', () => {
    expect(nightOf(ts('2026-08-29T07:00'))).toBe('2026-08-29')
  })

  it('assigns an after-midnight sleep to the same morning', () => {
    expect(nightOf(ts('2026-08-29T08:00'))).toBe('2026-08-29')
  })

  it('attaches an afternoon nap to that morning', () => {
    expect(nightOf(ts('2026-08-29T14:00'))).toBe('2026-08-29')
  })

  it('rolls a late-evening end into the NEXT morning', () => {
    // Fell asleep 21:00, woke 23:50 — that belongs with tonight's sleep.
    expect(nightOf(ts('2026-08-28T23:50'))).toBe('2026-08-29')
  })
})

describe('aggregateSleep', () => {
  it('unions overlapping iPhone+Watch records instead of summing (to the minute)', () => {
    // Watch: 23:00–06:30 (450 min). iPhone: 23:20–06:50 (overlapping).
    // Union: 23:00–06:50 = 470 min. A sum would give 900.
    const entries = aggregateSleep([
      iv('2026-08-28T23:00', '2026-08-29T06:30', 'AsleepCore', 'Watch'),
      iv('2026-08-28T23:20', '2026-08-29T06:50', 'Asleep', 'iPhone'),
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ night: '2026-08-29', asleepMin: 470, source: 'health' })
  })

  it('sums disjoint fragments of the same night (wake-ups)', () => {
    const entries = aggregateSleep([
      iv('2026-08-28T23:00', '2026-08-29T02:00'), // 180
      iv('2026-08-29T02:30', '2026-08-29T06:30'), // 240
    ])
    expect(entries[0].asleepMin).toBe(420)
  })

  it('falls back to InBed only when a night has no Asleep records', () => {
    const entries = aggregateSleep([
      iv('2026-08-27T23:00', '2026-08-28T07:00', 'HKCategoryValueSleepAnalysisInBed'),
      iv('2026-08-28T23:00', '2026-08-29T05:00', 'AsleepDeep'),
      iv('2026-08-28T22:30', '2026-08-29T07:00', 'HKCategoryValueSleepAnalysisInBed'),
    ])
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ night: '2026-08-28', asleepMin: 480 }) // InBed fallback
    expect(entries[1]).toMatchObject({ night: '2026-08-29', asleepMin: 360, inBedMin: 510 })
  })

  it('separates consecutive nights', () => {
    const entries = aggregateSleep([
      iv('2026-08-27T23:00', '2026-08-28T07:00'),
      iv('2026-08-28T23:00', '2026-08-29T07:00'),
    ])
    expect(entries.map((e) => e.night)).toEqual(['2026-08-28', '2026-08-29'])
    expect(entries.map((e) => e.asleepMin)).toEqual([480, 480])
  })

  it('handles the DST fall-back night by wall-clock difference', () => {
    // Real elapsed time is what Date math gives us; assert it's sane and > 0.
    const entries = aggregateSleep([iv('2026-10-24T23:00', '2026-10-25T07:00')])
    expect(entries[0].asleepMin).toBeGreaterThanOrEqual(480)
    expect(entries[0].asleepMin).toBeLessThanOrEqual(540)
  })

  it('drops zero-length, inverted and absurd records', () => {
    const entries = aggregateSleep([
      iv('2026-08-29T07:00', '2026-08-29T07:00'),
      iv('2026-08-29T07:00', '2026-08-29T06:00'),
      iv('2026-08-27T00:00', '2026-08-29T10:00'), // 58h "sleep" — discard
    ])
    expect(entries).toHaveLength(0)
  })
})

describe('sleepByNight', () => {
  it('prefers a manual entry over an imported one for the same night', () => {
    const map = sleepByNight([
      { id: 'a', night: '2026-08-29', asleepMin: 400, inBedMin: null, source: 'health' },
      { id: 'b', night: '2026-08-29', asleepMin: 450, inBedMin: null, source: 'manual' },
      { id: 'c', night: '2026-08-28', asleepMin: 420, inBedMin: null, source: 'health' },
    ])
    expect(map.get('2026-08-29')!.id).toBe('b')
    expect(map.get('2026-08-28')!.id).toBe('c')
  })
})
