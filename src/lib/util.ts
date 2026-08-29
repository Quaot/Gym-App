import type { Unit } from '../types'

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n))

/** Trims trailing zeros: 62.5 -> "62.5", 60 -> "60". */
export const fmtWeight = (w: number | null | undefined) =>
  w === null || w === undefined ? '' : String(Math.round(w * 100) / 100)

export const fmtSet = (weight: number | null, reps: number | null, unit: Unit) => {
  if (weight === null && reps === null) return '—'
  if (weight === null) return `${reps ?? '?'} reps`
  return `${fmtWeight(weight)} ${unit} × ${reps ?? '?'}`
}

export const fmtDuration = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const fmtDate = (ts: number) => {
  const d = new Date(ts)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const yday = new Date(today.getTime() - 86400000).toDateString() === d.toDateString()
  if (sameDay) return 'Today'
  if (yday) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export const daysAgo = (ts: number) =>
  Math.floor((Date.now() - ts) / 86400000)

/** Reorders an array immutably, moving `from` to `to`. */
export const move = <T,>(arr: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= arr.length) return arr
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
