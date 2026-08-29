import type { SleepEntry } from '../types'
import { uid } from './util'

/** One raw sleep interval from Apple Health (or any source). */
export interface SleepInterval {
  start: number
  end: number
  /** HKCategoryValueSleepAnalysis value string. */
  value: string
  sourceName?: string
}

const ASLEEP_RE = /Asleep/i
const IN_BED_RE = /InBed/i

/**
 * The night an interval belongs to: the local calendar date of its END, except
 * that anything ending before 18:00 belongs to that morning's date and
 * anything ending after 18:00 is counted as the *next* morning (an early
 * bedtime that ends 23:50 belongs with the sleep that continues past midnight).
 */
export const nightOf = (endTs: number): string => {
  const d = new Date(endTs)
  if (d.getHours() >= 18) d.setDate(d.getDate() + 1)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Union of possibly-overlapping intervals, in minutes. */
const unionMinutes = (intervals: { start: number; end: number }[]): number => {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start)
  let total = 0
  let cur: { start: number; end: number } | null = null
  for (const i of sorted) {
    if (cur === null || i.start > cur.end) {
      if (cur !== null) total += cur.end - cur.start
      cur = { start: i.start, end: i.end }
    } else {
      cur.end = Math.max(cur.end, i.end)
    }
  }
  if (cur !== null) total += cur.end - cur.start
  return Math.round(total / 60000)
}

/**
 * Collapses raw Health intervals into one entry per night.
 *
 * - "Asleep*" stages are the sleep signal; "InBed" is kept separately and used
 *   as the fallback for nights with no Asleep data (old phone-only records).
 * - Overlapping intervals (iPhone + Watch both reporting) are UNIONED, never
 *   summed, so double-reporting can't double the hours.
 */
export const aggregateSleep = (intervals: SleepInterval[]): SleepEntry[] => {
  const byNight = new Map<string, { asleep: SleepInterval[]; inBed: SleepInterval[] }>()
  for (const i of intervals) {
    if (i.end <= i.start) continue
    const night = nightOf(i.end)
    let bucket = byNight.get(night)
    if (!bucket) {
      bucket = { asleep: [], inBed: [] }
      byNight.set(night, bucket)
    }
    if (ASLEEP_RE.test(i.value)) bucket.asleep.push(i)
    else if (IN_BED_RE.test(i.value)) bucket.inBed.push(i)
  }

  const out: SleepEntry[] = []
  for (const [night, { asleep, inBed }] of byNight) {
    const asleepMin = asleep.length > 0 ? unionMinutes(asleep) : unionMinutes(inBed)
    if (asleepMin <= 0 || asleepMin > 24 * 60) continue
    out.push({
      id: uid(),
      night,
      asleepMin,
      inBedMin: inBed.length > 0 ? unionMinutes(inBed) : null,
      source: 'health',
    })
  }
  return out.sort((a, b) => a.night.localeCompare(b.night))
}

/** Preferred entry per night: manual wins over imported. */
export const sleepByNight = (entries: SleepEntry[]): Map<string, SleepEntry> => {
  const map = new Map<string, SleepEntry>()
  for (const e of entries) {
    const existing = map.get(e.night)
    if (!existing || (existing.source === 'health' && e.source === 'manual')) {
      map.set(e.night, e)
    }
  }
  return map
}
