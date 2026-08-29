import type { TrendPoint } from './analytics'

/**
 * Where a lift is heading.
 *
 * Fits a line through the estimated maxes you have actually logged and reads
 * the date off it. This is a projection of your own trend, not a promise: it
 * refuses to answer when the evidence is thin, when the trend is flat or
 * falling, or when the answer is so far out that it would be noise dressed as
 * a date.
 */

const DAY = 86400000

/** Fewer sessions than this and a line through them means nothing. */
export const MIN_POINTS = 4
/** A trend needs a span to be a trend. */
export const MIN_SPAN_DAYS = 14
/** Past this the projection is arithmetic, not a forecast. */
export const MAX_HORIZON_DAYS = 180

export interface Fit {
  /** Units per day. */
  slope: number
  /** Value the line gives at t. */
  at: (t: number) => number
  /** How much of the variation the line explains, 0 to 1. */
  r2: number
}

/** Least squares through (t, score), with time measured in days. */
export const fitTrend = (points: { t: number; score: number }[]): Fit | null => {
  if (points.length < 2) return null
  const t0 = points[0].t
  const xs = points.map((p) => (p.t - t0) / DAY)
  const ys = points.map((p) => p.score)
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n

  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
  }
  if (sxx === 0) return null

  const slope = sxy / sxx
  const intercept = my - slope * mx
  const at = (t: number) => intercept + slope * ((t - t0) / DAY)

  let ssRes = 0
  let ssTot = 0
  for (let i = 0; i < n; i++) {
    ssRes += (ys[i] - (intercept + slope * xs[i])) ** 2
    ssTot += (ys[i] - my) ** 2
  }

  return { slope, at, r2: ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot) }
}

export interface Forecast {
  /** The weight the projection is aimed at. */
  target: number
  /** Reps that target is for. */
  reps: number
  /** When the trend reaches it. */
  when: number
  /** Days from now. */
  inDays: number
  /** Gain per week at the current rate. */
  perWeek: number
  /** How well the line fits what you have logged. */
  r2: number
}

/**
 * The next round number above what you are lifting now, so the target is one
 * you would actually announce: 205, 225, 250, and so on.
 */
export const nextTarget = (current: number, increment: number): number => {
  const round = increment >= 5 ? 20 : 10
  return Math.floor(current / round) * round + round
}

/**
 * Reads a date off your own trend, or says nothing. `reps` is the rep count
 * the target is quoted at, taken from what you have been doing lately.
 */
export const forecastFor = (
  points: TrendPoint[],
  increment: number,
  now = Date.now(),
): Forecast | null => {
  if (points.length < MIN_POINTS) return null
  const span = (points[points.length - 1].t - points[0].t) / DAY
  if (span < MIN_SPAN_DAYS) return null

  const fit = fitTrend(points)
  if (!fit || fit.slope <= 0) return null
  // A line through noise is still a line, so it has to explain the data too.
  if (fit.r2 < 0.4) return null

  const last = points[points.length - 1]
  const reps = last.reps > 0 ? last.reps : 5
  // Quote the target as a working weight at those reps, which is what you
  // would actually load, rather than as an estimated max nobody lifts.
  const asWorking = (e1rm: number) => e1rm / (1 + reps / 30)
  const current = asWorking(fit.at(now))
  const target = nextTarget(current, increment)
  const targetE1rm = target * (1 + reps / 30)

  const days = (targetE1rm - fit.at(now)) / fit.slope
  if (!Number.isFinite(days) || days < 0 || days > MAX_HORIZON_DAYS) return null

  return {
    target,
    reps,
    when: now + days * DAY,
    inDays: Math.ceil(days),
    perWeek: Math.round(fit.slope * 7 * 10) / 10,
    r2: Math.round(fit.r2 * 100) / 100,
  }
}
