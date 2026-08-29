import { describe, expect, it } from 'vitest'
import type { TrendPoint } from './analytics'
import { MAX_HORIZON_DAYS, fitTrend, forecastFor, nextTarget } from './forecast'

const DAY = 86400000
const NOW = Date.UTC(2026, 0, 1)

/** Sessions every `every` days, ending today, at a steady rate of gain. */
const climbing = (
  n: number, from: number, perSession: number, every = 7, reps = 5,
): TrendPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    t: NOW - (n - 1 - i) * every * DAY,
    score: from + i * perSession,
    weight: from + i * perSession,
    reps,
    isPR: false,
  }))

describe('fitTrend', () => {
  it('reads the slope of a straight line exactly', () => {
    const fit = fitTrend([
      { t: NOW, score: 100 },
      { t: NOW + 10 * DAY, score: 110 },
      { t: NOW + 20 * DAY, score: 120 },
    ])!
    expect(fit.slope).toBeCloseTo(1)
    expect(fit.r2).toBeCloseTo(1)
    expect(fit.at(NOW + 30 * DAY)).toBeCloseTo(130)
  })

  it('reports a poor fit for scattered points', () => {
    const fit = fitTrend([
      { t: NOW, score: 100 },
      { t: NOW + DAY, score: 140 },
      { t: NOW + 2 * DAY, score: 95 },
      { t: NOW + 3 * DAY, score: 130 },
    ])!
    expect(fit.r2).toBeLessThan(0.4)
  })

  it('says nothing with one point or with no spread in time', () => {
    expect(fitTrend([{ t: NOW, score: 100 }])).toBeNull()
    expect(fitTrend([{ t: NOW, score: 100 }, { t: NOW, score: 120 }])).toBeNull()
  })
})

describe('nextTarget', () => {
  it('picks the next round number a lifter would announce', () => {
    expect(nextTarget(186, 5)).toBe(200)
    expect(nextTarget(205, 5)).toBe(220)
    expect(nextTarget(219.9, 5)).toBe(220)
  })

  it('rounds tighter on small increments', () => {
    expect(nextTarget(42, 2.5)).toBe(50)
    expect(nextTarget(51, 1.25)).toBe(60)
  })

  it('always lands above where you are now', () => {
    for (let w = 1; w < 400; w += 3.7) expect(nextTarget(w, 5)).toBeGreaterThan(w)
  })
})

describe('forecastFor', () => {
  it('names a target, a date and a rate from a steady climb', () => {
    const out = forecastFor(climbing(8, 185, 5), 5, NOW)!
    expect(out.target).toBeGreaterThan(185)
    expect(out.reps).toBe(5)
    expect(out.inDays).toBeGreaterThan(0)
    expect(out.inDays).toBeLessThanOrEqual(MAX_HORIZON_DAYS)
    expect(out.perWeek).toBeGreaterThan(0)
    expect(out.r2).toBeGreaterThan(0.9)
  })

  it('puts the date where the arithmetic puts it', () => {
    // 5 lb of estimated max a week, ending at 245, so the gap to the target
    // is measured from there rather than from where the block started.
    const points = climbing(10, 200, 5)
    const out = forecastFor(points, 5, NOW)!
    const here = points[points.length - 1].score
    const gainNeeded = out.target * (1 + out.reps / 30) - here
    const days = (gainNeeded / out.perWeek) * 7
    expect(out.inDays).toBeGreaterThan(days - 3)
    expect(out.inDays).toBeLessThan(days + 3)
  })

  it('says nothing before there is enough history', () => {
    expect(forecastFor(climbing(3, 185, 5), 5, NOW)).toBeNull()
  })

  it('says nothing when the sessions are packed into a few days', () => {
    expect(forecastFor(climbing(6, 185, 5, 1), 5, NOW)).toBeNull()
  })

  it('says nothing when the trend is flat or falling', () => {
    expect(forecastFor(climbing(8, 185, 0), 5, NOW)).toBeNull()
    expect(forecastFor(climbing(8, 225, -5), 5, NOW)).toBeNull()
  })

  it('says nothing when the line does not explain the data', () => {
    const noisy = climbing(10, 185, 1).map((p, i) => ({
      ...p,
      score: p.score + (i % 2 === 0 ? 45 : -45),
    }))
    expect(forecastFor(noisy, 5, NOW)).toBeNull()
  })

  it('refuses a date beyond the horizon rather than guessing', () => {
    // A crawl: a 20 lb jump would take years, so it declines to say.
    expect(forecastFor(climbing(12, 300, 0.05), 5, NOW)).toBeNull()
  })

  it('quotes the target at the reps you have been doing', () => {
    const out = forecastFor(climbing(8, 100, 4, 7, 10), 5, NOW)!
    expect(out.reps).toBe(10)
  })

  it('reads a bodyweight movement in reps without falling over', () => {
    const pullUps = climbing(8, 8, 1).map((p) => ({ ...p, weight: null }))
    const out = forecastFor(pullUps, 5, NOW)
    expect(out === null || out.target > 8).toBe(true)
  })
})
